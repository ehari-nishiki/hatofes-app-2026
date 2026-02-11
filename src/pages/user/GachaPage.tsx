import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, limit, doc, getDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'
import { animate, stagger } from 'animejs'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import { GachaConfetti } from '@/components/ui/GachaConfetti'
import { GachaRevealOverlay } from '@/components/ui/GachaRevealOverlay'
import { GachaItemDetailModal } from '@/components/ui/GachaItemDetailModal'
import { AnimatedButton } from '@/components/ui/AnimatedButton'
import type { GachaHistoryEntry, GachaRarity, GachaItem } from '@/types/firestore'

const functions = getFunctions(app)
const pullGachaFn = httpsCallable<
  Record<string, never>,
  {
    success: boolean
    item: {
      id: string
      name: string
      description: string
      rarity: GachaRarity
      type: string
      pointsValue: number | null
      ticketValue: number | null
      imageUrl?: string
    }
  }
>(functions, 'pullGacha')

type PullResult = {
  id: string
  name: string
  description: string
  rarity: GachaRarity
  type: string
  pointsValue: number | null
  ticketValue: number | null
  imageUrl?: string
}

const RARITY_COLORS: Record<GachaRarity, string> = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-hatofes-accent-yellow',
}

const RARITY_BG: Record<GachaRarity, string> = {
  common: 'bg-gray-500/20 border-gray-500',
  uncommon: 'bg-green-500/20 border-green-500',
  rare: 'bg-blue-500/20 border-blue-500',
  epic: 'bg-purple-500/20 border-purple-500',
  legendary: 'bg-hatofes-accent-yellow/20 border-hatofes-accent-yellow',
}

const RARITY_LABELS: Record<GachaRarity, string> = {
  common: 'コモン',
  uncommon: 'アンコモン',
  rare: 'レア',
  epic: 'エピック',
  legendary: 'レジェンダリー',
}

const RARITY_ORDER: Record<GachaRarity, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4,
}

type HistoryItemWithDetails = GachaHistoryEntry & {
  id: string
  imageUrl?: string
  description?: string
  type?: string
  pointsValue?: number
  ticketValue?: number
}

export default function GachaPage() {
  const { userData, refreshUserData } = useAuth()
  const [pulling, setPulling] = useState(false)
  const [currentReveal, setCurrentReveal] = useState<PullResult | null>(null)
  const [results, setResults] = useState<PullResult[]>([])
  const [revealQueue, setRevealQueue] = useState<PullResult[]>([])
  const [history, setHistory] = useState<HistoryItemWithDetails[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [rewardAmount, setRewardAmount] = useState(0)
  const [rewardType, setRewardType] = useState<'points' | 'ticket'>('points')
  const [pullError, setPullError] = useState<string | null>(null)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItemWithDetails | null>(null)

  const machineRef = useRef<HTMLDivElement>(null)
  const ballsRef = useRef<HTMLDivElement>(null)

  const tickets = userData?.gachaTickets ?? 0

  const bestRarity: GachaRarity = results.length > 0
    ? results.reduce((best, r) => RARITY_ORDER[r.rarity] > RARITY_ORDER[best.rarity] ? r : best, results[0]).rarity
    : 'common'

  useEffect(() => {
    if (!userData) return
    fetchHistory()
  }, [userData])

  // Animate machine on mount
  useEffect(() => {
    if (machineRef.current) {
      animate(machineRef.current, {
        scale: [0.9, 1],
        opacity: [0, 1],
        duration: 800,
        ease: 'outBack',
      })
    }
    // Floating balls animation
    if (ballsRef.current) {
      animate(ballsRef.current.children, {
        translateY: [-5, 5],
        duration: 1500,
        delay: stagger(200),
        alternate: true,
        loop: true,
        ease: 'inOutSine',
      })
    }
  }, [])

  const fetchHistory = async () => {
    const authInstance = getAuth()
    if (!authInstance.currentUser) { setHistoryLoading(false); return }
    const uid = authInstance.currentUser.uid
    try {
      const q = query(
        collection(db, 'gachaHistory'),
        where('userId', '==', uid),
        orderBy('pulledAt', 'desc'),
        limit(20)
      )
      const snap = await getDocs(q)
      const list: HistoryItemWithDetails[] = []

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as GachaHistoryEntry
        let itemDetails: Partial<GachaItem> = {}

        // Fetch item details for image
        try {
          const itemDoc = await getDoc(doc(db, 'gachaItems', data.itemId))
          if (itemDoc.exists()) {
            itemDetails = itemDoc.data() as GachaItem
          }
        } catch {
          // Ignore if item not found
        }

        list.push({
          id: docSnap.id,
          ...data,
          imageUrl: itemDetails.imageUrl,
          description: itemDetails.description,
          type: itemDetails.type,
          pointsValue: itemDetails.pointsValue,
          ticketValue: itemDetails.ticketValue,
        })
      }
      setHistory(list)
    } catch (error) {
      console.error('Error fetching gacha history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handlePull = async (count: 1 | 10) => {
    if (pulling || currentReveal || tickets < count) return
    setPulling(true)
    setResults([])
    setPullError(null)

    // Shake animation
    if (machineRef.current) {
      animate(machineRef.current, {
        rotate: [-2, 2, -2, 2, 0],
        duration: 200,
        loop: true,
      })
    }

    const minDelay = count === 1 ? 1500 : 2500
    const collected: PullResult[] = []

    await Promise.all([
      (async () => {
        for (let i = 0; i < count; i++) {
          try {
            const res = await pullGachaFn({} as Record<string, never>)
            collected.push({
              ...res.data.item,
              description: res.data.item.description || '',
            })
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'ガチャの抽選に失敗しました'
            setPullError(msg)
            break
          }
        }
      })(),
      new Promise(resolve => setTimeout(resolve, minDelay)),
    ])

    // Stop shake animation
    if (machineRef.current) {
      // Reset rotation
      machineRef.current.style.transform = ''
      animate(machineRef.current, {
        rotate: 0,
        duration: 200,
      })
    }

    setPulling(false)
    if (collected.length === 0) return

    setResults(collected)

    if (count === 1) {
      // Single pull - show dramatic reveal
      setCurrentReveal(collected[0])
    } else {
      // 10 pull - queue reveals for best items, show list for rest
      const sorted = [...collected].sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity])
      // Show reveal for epic+ items
      const specialItems = sorted.filter(r => RARITY_ORDER[r.rarity] >= RARITY_ORDER['rare'])
      if (specialItems.length > 0) {
        setRevealQueue(specialItems)
        setCurrentReveal(specialItems[0])
      } else {
        finishPull(collected)
      }
    }
  }

  const handleRevealComplete = () => {
    if (revealQueue.length > 1) {
      // More items to reveal
      const remaining = revealQueue.slice(1)
      setRevealQueue(remaining)
      setTimeout(() => setCurrentReveal(remaining[0]), 300)
    } else {
      // All reveals done
      setRevealQueue([])
      setCurrentReveal(null)
      finishPull(results)
    }
  }

  const finishPull = (collected: PullResult[]) => {
    let totalPt = 0, totalTk = 0
    for (const r of collected) {
      if (r.type === 'points' && r.pointsValue) totalPt += r.pointsValue
      if (r.type === 'ticket' && r.ticketValue) totalTk += r.ticketValue
    }
    if (totalPt > 0) {
      setRewardType('points'); setRewardAmount(totalPt); setShowRewardModal(true)
    } else if (totalTk > 0) {
      setRewardType('ticket'); setRewardAmount(totalTk); setShowRewardModal(true)
    }
    fetchHistory()
    refreshUserData?.()
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const busy = pulling || !!currentReveal

  return (
    <>
      <GachaConfetti active={results.length > 0 && !currentReveal} rarity={bestRarity} />

      {currentReveal && (
        <GachaRevealOverlay
          active={true}
          rarity={currentReveal.rarity}
          itemName={currentReveal.name}
          itemDescription={currentReveal.description}
          itemImageUrl={currentReveal.imageUrl}
          itemType={currentReveal.type}
          pointsValue={currentReveal.pointsValue}
          ticketValue={currentReveal.ticketValue}
          onComplete={handleRevealComplete}
        />
      )}

      {showRewardModal && (
        <PointRewardModal
          isOpen={showRewardModal}
          points={rewardAmount}
          reason={rewardType === 'ticket'
            ? `ガチャから${rewardAmount}枚チケット獲得`
            : `ガチャから${rewardAmount}pt獲得`}
          unit={rewardType === 'ticket' ? '🎫枚' : 'pt'}
          title={rewardType === 'ticket' ? 'チケット獲得！' : 'ポイント獲得！'}
          onClose={() => setShowRewardModal(false)}
        />
      )}

      {selectedHistoryItem && (
        <GachaItemDetailModal
          isOpen={true}
          onClose={() => setSelectedHistoryItem(null)}
          item={{
            name: selectedHistoryItem.itemName,
            description: selectedHistoryItem.description,
            rarity: selectedHistoryItem.itemRarity,
            type: selectedHistoryItem.type || 'custom',
            imageUrl: selectedHistoryItem.imageUrl,
            pointsValue: selectedHistoryItem.pointsValue,
            ticketValue: selectedHistoryItem.ticketValue,
            pulledAt: selectedHistoryItem.pulledAt,
          }}
        />
      )}

      <div className="min-h-screen bg-hatofes-bg pb-8">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />

        <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Ticket counter with animation */}
          <section className="card text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-hatofes-accent-yellow/5 via-transparent to-hatofes-accent-orange/5" />
            <div className="relative">
              <p className="text-hatofes-gray text-sm mb-1">チケット残数</p>
              <p className="text-4xl font-bold text-hatofes-white font-display">
                <span className="inline-block animate-bounce-subtle">🎫</span>{' '}
                <span className="text-gradient">{tickets}</span>
                <span className="text-lg text-hatofes-gray ml-1">枚</span>
              </p>
            </div>
          </section>

          {/* Error */}
          {pullError && (
            <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg text-center border border-red-500/30">
              {pullError}
            </div>
          )}

          {/* Gacha Machine - Enhanced */}
          <section className="card text-center relative overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-hatofes-accent-yellow/5 to-transparent" />

            <div
              ref={machineRef}
              className={`relative mx-auto w-44 h-52 rounded-t-full border-4 border-hatofes-accent-yellow bg-gradient-to-b from-hatofes-dark to-hatofes-bg flex items-end justify-center pb-4 overflow-hidden opacity-0`}
              style={{
                boxShadow: '0 0 30px rgba(255,195,0,0.2), inset 0 -20px 40px rgba(0,0,0,0.5)',
              }}
            >
              {/* Glow effect when pulling */}
              {pulling && (
                <div className="absolute inset-0 bg-gradient-to-t from-hatofes-accent-yellow/20 to-transparent animate-pulse" />
              )}

              {/* Balls inside */}
              <div ref={ballsRef} className={`flex flex-wrap gap-1 justify-center p-2 ${pulling ? 'animate-bounce' : ''}`}>
                {['bg-red-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-hatofes-accent-yellow', 'bg-pink-400', 'bg-cyan-400'].map((color, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 ${color} rounded-full`}
                    style={{
                      boxShadow: `0 2px 4px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)`,
                    }}
                  />
                ))}
              </div>

              {/* Glass reflection */}
              <div
                className="absolute top-0 left-0 w-1/3 h-full opacity-20"
                style={{
                  background: 'linear-gradient(90deg, transparent, white, transparent)',
                }}
              />
            </div>

            {/* Dispenser */}
            <div className="relative">
              <div
                className="w-24 h-5 bg-gradient-to-b from-hatofes-accent-orange to-hatofes-accent-yellow rounded-b-lg mx-auto"
                style={{ boxShadow: '0 4px 10px rgba(255,78,0,0.3)' }}
              />
              <div className="w-8 h-3 bg-hatofes-dark rounded-b-lg mx-auto" />
            </div>

            {/* Pull buttons - 英語に変更 */}
            <div className="flex gap-4 mt-6 relative">
              <AnimatedButton
                onClick={() => handlePull(1)}
                disabled={busy || tickets < 1}
                loading={pulling}
                variant="primary"
                size="lg"
                className="flex-1"
                loadingText="..."
              >
                {tickets < 1 ? 'No Ticket' : '1 Pull'}
              </AnimatedButton>

              <AnimatedButton
                onClick={() => handlePull(10)}
                disabled={busy || tickets < 10}
                loading={pulling}
                variant="gradient"
                size="lg"
                className="flex-1"
              >
                10 Pull
              </AnimatedButton>
            </div>
          </section>

          {/* Results display - only for 10 pull list */}
          {results.length > 1 && !currentReveal && !revealQueue.length && (
            <section className="card">
              <h2 className="text-hatofes-white font-bold mb-3 text-center flex items-center justify-center gap-2 font-display">
                <span className="text-xl">🎊</span>
                Result
                <span className="text-xl">🎊</span>
              </h2>
              <ul className="space-y-2">
                {[...results]
                  .sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity])
                  .map((r, i) => {
                    const isBest = i === 0
                    return (
                      <li
                        key={i}
                        onClick={() => setSelectedHistoryItem({
                          id: `result-${i}`,
                          userId: '',
                          itemId: r.id,
                          itemName: r.name,
                          itemRarity: r.rarity,
                          pulledAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as import('firebase/firestore').Timestamp,
                          imageUrl: r.imageUrl,
                          description: r.description,
                          type: r.type,
                          pointsValue: r.pointsValue ?? undefined,
                          ticketValue: r.ticketValue ?? undefined,
                        })}
                        className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                          isBest ? `border ${RARITY_BG[r.rarity]}` : 'bg-hatofes-dark hover:bg-hatofes-dark/80'
                        }`}
                        style={{
                          animationDelay: `${i * 50}ms`,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {r.imageUrl ? (
                            <img src={r.imageUrl} alt={r.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${RARITY_BG[r.rarity].split(' ')[0]}`}>
                              {r.type === 'points' ? '💰' : r.type === 'ticket' ? '🎫' : '🎁'}
                            </div>
                          )}
                          <div>
                            <p className={`text-sm ${isBest ? 'font-bold' : ''} text-hatofes-white`}>{r.name}</p>
                            <span className={`text-xs font-bold ${RARITY_COLORS[r.rarity]}`}>{RARITY_LABELS[r.rarity]}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            {r.type === 'points' && r.pointsValue && (
                              <span className="text-sm text-hatofes-accent-yellow font-bold font-display">+{r.pointsValue}pt</span>
                            )}
                            {r.type === 'ticket' && r.ticketValue && (
                              <span className="text-sm text-hatofes-accent-yellow font-bold font-display">+{r.ticketValue}🎫</span>
                            )}
                            {isBest && <span className="block text-xs text-hatofes-accent-yellow mt-0.5">★ Best</span>}
                          </div>
                          <svg className="w-4 h-4 text-hatofes-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </li>
                    )
                  })
                }
              </ul>
            </section>
          )}

          {/* History - Clickable items */}
          <section className="card">
            <h2 className="font-bold text-hatofes-white mb-4 flex items-center gap-2">
              <span>📜</span> 引き歴
            </h2>
            {historyLoading ? (
              <div className="flex justify-center py-4"><Spinner size="md" /></div>
            ) : history.length === 0 ? (
              <p className="text-hatofes-gray text-center py-4 text-sm">まだガチャを引いていません</p>
            ) : (
              <ul className="space-y-2">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    onClick={() => setSelectedHistoryItem(entry)}
                    className="flex items-center justify-between py-2.5 px-3 -mx-1 rounded-lg cursor-pointer hover:bg-hatofes-dark/50 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      {entry.imageUrl ? (
                        <img src={entry.imageUrl} alt={entry.itemName} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${RARITY_BG[entry.itemRarity].split(' ')[0]}`}>
                          {entry.type === 'points' ? '💰' : entry.type === 'ticket' ? '🎫' : '🎁'}
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-hatofes-white">{entry.itemName}</p>
                        <p className={`text-xs font-bold ${RARITY_COLORS[entry.itemRarity]}`}>{RARITY_LABELS[entry.itemRarity]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-hatofes-gray">
                        {entry.pulledAt?.seconds ? new Date(entry.pulledAt.seconds * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : ''}
                      </p>
                      <svg className="w-4 h-4 text-hatofes-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link to="/home" className="block">
            <div className="btn-sub w-full py-3 text-center">ホームに戻る</div>
          </Link>
        </main>
      </div>

      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
        .text-gradient {
          background: linear-gradient(90deg, #FFC300, #FF4E00);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
    </>
  )
}
