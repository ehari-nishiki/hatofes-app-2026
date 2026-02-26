import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, limit, doc, getDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { SkeletonCard } from '@/components/ui/SkeletonLoader'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import { GachaConfetti } from '@/components/ui/GachaConfetti'
import { GachaItemDetailModal } from '@/components/ui/GachaItemDetailModal'
import { WebGLAurora } from '@/components/ui/WebGLAurora'
import { GachaPullLoading } from '@/components/gacha/GachaPullLoading'
import { GachaCardReveal } from '@/components/gacha/GachaCardReveal'
import type { GachaHistoryEntry, GachaRarity, GachaItem } from '@/types/firestore'

const functions = getFunctions(app)

// Batch pull function for better performance
const pullGachaBatchFn = httpsCallable<
  { count: number },
  {
    success: boolean
    items: Array<{
      id: string
      name: string
      description: string
      rarity: GachaRarity
      type: string
      pointsValue: number | null
      ticketValue: number | null
      imageUrl?: string
    }>
  }
>(functions, 'pullGachaBatch')

// Fallback single pull
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
  common: 'bg-gray-500/20 border-gray-500/50',
  uncommon: 'bg-green-500/20 border-green-500/50',
  rare: 'bg-blue-500/20 border-blue-500/50',
  epic: 'bg-purple-500/20 border-purple-500/50',
  legendary: 'bg-hatofes-accent-yellow/20 border-hatofes-accent-yellow/50',
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

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Pull state
  const [pulling, setPulling] = useState(false)
  const [pullCount, setPullCount] = useState<1 | 10>(1)
  const [results, setResults] = useState<PullResult[]>([])
  const [pullError, setPullError] = useState<string | null>(null)

  // Animation states
  const [showLoading, setShowLoading] = useState(false)
  const [showCardReveal, setShowCardReveal] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // History & modals
  const [history, setHistory] = useState<HistoryItemWithDetails[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [rewardAmount, setRewardAmount] = useState(0)
  const [rewardType, setRewardType] = useState<'points' | 'ticket'>('points')
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItemWithDetails | null>(null)

  const tickets = userData?.gachaTickets ?? 0

  const bestRarity: GachaRarity = results.length > 0
    ? results.reduce((best, r) => RARITY_ORDER[r.rarity] > RARITY_ORDER[best.rarity] ? r : best, results[0]).rarity
    : 'common'

  useEffect(() => {
    if (!userData) return
    fetchHistory()
  }, [userData])

  const fetchHistory = async () => {
    const authInstance = getAuth()
    if (!authInstance.currentUser) { setHistoryLoading(false); return }
    const uid = authInstance.currentUser.uid
    try {
      const q = query(
        collection(db, 'gachaHistory'),
        where('userId', '==', uid),
        orderBy('pulledAt', 'desc'),
        limit(10)
      )
      const snap = await getDocs(q)
      const list: HistoryItemWithDetails[] = []

      // Batch fetch item details
      const itemIds = [...new Set(snap.docs.map(d => d.data().itemId))]
      const itemDetailsMap = new Map<string, Partial<GachaItem>>()

      await Promise.all(
        itemIds.map(async (itemId) => {
          try {
            const itemDoc = await getDoc(doc(db, 'gachaItems', itemId))
            if (itemDoc.exists()) {
              itemDetailsMap.set(itemId, itemDoc.data() as GachaItem)
            }
          } catch {
            // Ignore
          }
        })
      )

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as GachaHistoryEntry
        const itemDetails = itemDetailsMap.get(data.itemId) || {}

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
    if (pulling || showCardReveal || tickets < count) return

    setPulling(true)
    setPullCount(count)
    setResults([])
    setPullError(null)
    setShowResults(false)
    setShowLoading(true)

    const collected: PullResult[] = []

    try {
      // Try batch pull first (faster)
      if (count > 1) {
        try {
          const res = await pullGachaBatchFn({ count })
          collected.push(...res.data.items.map(item => ({
            ...item,
            description: item.description || '',
          })))
        } catch {
          // Fallback to sequential pulls
          for (let i = 0; i < count; i++) {
            const res = await pullGachaFn({} as Record<string, never>)
            collected.push({
              ...res.data.item,
              description: res.data.item.description || '',
            })
          }
        }
      } else {
        const res = await pullGachaFn({} as Record<string, never>)
        collected.push({
          ...res.data.item,
          description: res.data.item.description || '',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ガチャの抽選に失敗しました'
      setPullError(msg)
      setPulling(false)
      setShowLoading(false)
      return
    }

    setPulling(false)

    if (collected.length === 0) {
      setShowLoading(false)
      return
    }

    setResults(collected)

    // Wait a bit for loading animation effect, then show cards
    setTimeout(() => {
      setShowLoading(false)
      setShowCardReveal(true)
    }, 1500)
  }

  const handleCardRevealComplete = () => {
    setShowCardReveal(false)
    setShowResults(true)

    // Calculate rewards
    let totalPt = 0, totalTk = 0
    for (const r of results) {
      if (r.type === 'points' && r.pointsValue) totalPt += r.pointsValue
      if (r.type === 'ticket' && r.ticketValue) totalTk += r.ticketValue
    }

    if (totalPt > 0) {
      setRewardType('points')
      setRewardAmount(totalPt)
      setShowRewardModal(true)
    } else if (totalTk > 0) {
      setRewardType('ticket')
      setRewardAmount(totalTk)
      setShowRewardModal(true)
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

  const busy = pulling || showCardReveal || showLoading

  return (
    <>
      {/* Confetti for results */}
      <GachaConfetti active={showResults && results.length > 0} rarity={bestRarity} />

      {/* Loading animation */}
      <GachaPullLoading active={showLoading} pullCount={pullCount} />

      {/* Card reveal */}
      <GachaCardReveal
        active={showCardReveal}
        cards={results}
        onComplete={handleCardRevealComplete}
      />

      {/* Reward modal */}
      {showRewardModal && (
        <PointRewardModal
          isOpen={showRewardModal}
          points={rewardAmount}
          reason={rewardType === 'ticket'
            ? `ガチャから${rewardAmount}枚チケット獲得`
            : `ガチャから${rewardAmount}pt獲得`}
          unit={rewardType === 'ticket' ? '🎫枚' : 'pt'}
          title={rewardType === 'ticket' ? 'チケット獲得!' : 'ポイント獲得!'}
          onClose={() => setShowRewardModal(false)}
        />
      )}

      {/* History item detail modal */}
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

      <div className="min-h-screen bg-hatofes-bg pb-8 relative overflow-hidden">
        {/* WebGL Aurora Background */}
        <div className="fixed inset-0 z-0">
          <WebGLAurora intensity="normal" colorScheme="gold" />
        </div>

        <div className="relative z-10">
          <AppHeader
            username={userData.username}
            grade={userData.grade}
            classNumber={userData.class}
          />

          <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
            {/* Ticket counter - Glass morphism */}
            <section className="glass-card text-center fade-in-up">
              <p className="text-white/60 text-sm mb-1">チケット残数</p>
              <p className="text-5xl font-bold text-white font-display">
                <span className="inline-block animate-bounce-subtle">🎫</span>{' '}
                <span className="text-gradient">{tickets}</span>
              </p>
            </section>

            {/* Error */}
            {pullError && (
              <div className="glass-card bg-red-500/10 border-red-500/30 text-red-400 text-sm text-center">
                {pullError}
              </div>
            )}

            {/* Pull Buttons */}
            <div className="space-y-4">
              <button
                onClick={() => handlePull(1)}
                disabled={busy || tickets < 1}
                className="w-full py-5 rounded-2xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed glass-card border-2 border-white/20 hover:border-hatofes-accent-yellow/50 hover:shadow-[0_0_30px_rgba(255,195,0,0.3)] active:scale-[0.98]"
              >
                {tickets < 1 ? (
                  <span className="text-white/50">チケットが足りません</span>
                ) : (
                  <span className="text-white">🎰 1回引く</span>
                )}
              </button>

              <button
                onClick={() => handlePull(10)}
                disabled={busy || tickets < 10}
                className="w-full py-5 rounded-2xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed glass-card border-2 border-white/20 hover:border-hatofes-accent-yellow/50 hover:shadow-[0_0_30px_rgba(255,195,0,0.3)] active:scale-[0.98]"
              >
                {tickets < 10 ? (
                  <span className="text-white/50">チケットが足りません (10枚必要)</span>
                ) : (
                  <span className="text-white">🎰 10回引く</span>
                )}
              </button>
            </div>

            {/* Results display */}
            {showResults && results.length > 0 && (
              <section className="glass-card fade-in-up">
                <h2 className="text-white font-bold mb-3 text-center font-display">
                  🎊 結果 🎊
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
                          className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer hover:bg-white/10 active:scale-[0.98] ${
                            isBest ? `border ${RARITY_BG[r.rarity]}` : 'bg-white/5'
                          }`}
                          style={{ animationDelay: `${i * 50}ms` }}
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
                              <p className={`text-sm ${isBest ? 'font-bold' : ''} text-white`}>{r.name}</p>
                              <span className={`text-xs font-bold ${RARITY_COLORS[r.rarity]}`}>{RARITY_LABELS[r.rarity]}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {r.type === 'points' && r.pointsValue && (
                              <span className="text-sm text-hatofes-accent-yellow font-bold font-display">+{r.pointsValue}pt</span>
                            )}
                            {r.type === 'ticket' && r.ticketValue && (
                              <span className="text-sm text-hatofes-accent-yellow font-bold font-display">+{r.ticketValue}🎫</span>
                            )}
                          </div>
                        </li>
                      )
                    })
                  }
                </ul>
              </section>
            )}

            {/* History - Glass morphism */}
            <section className="glass-card fade-in-up fade-in-delay-2">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                📜 引き歴
              </h2>
              {historyLoading ? (
                <SkeletonCard count={3} />
              ) : history.length === 0 ? (
                <p className="text-white/50 text-center py-4 text-sm">まだガチャを引いていません</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      onClick={() => setSelectedHistoryItem(entry)}
                      className="flex items-center justify-between py-2.5 px-3 rounded-xl cursor-pointer hover:bg-white/10 transition-all active:scale-[0.98]"
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
                          <p className="text-sm text-white">{entry.itemName}</p>
                          <p className={`text-xs font-bold ${RARITY_COLORS[entry.itemRarity]}`}>{RARITY_LABELS[entry.itemRarity]}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-white/50">
                          {entry.pulledAt?.seconds ? new Date(entry.pulledAt.seconds * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : ''}
                        </p>
                        <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Link to="/home" className="block fade-in-up fade-in-delay-3">
              <div className="glass-card text-center py-3 text-white/80 hover:text-white hover:bg-white/10 transition-all">
                ホームに戻る
              </div>
            </Link>
          </main>
        </div>
      </div>

      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 1rem;
          padding: 1rem;
        }
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
