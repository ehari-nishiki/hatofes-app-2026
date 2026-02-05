import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import { GachaConfetti } from '@/components/ui/GachaConfetti'
import type { GachaHistoryEntry, GachaRarity } from '@/types/firestore'

const functions = getFunctions(app)
const pullGachaFn = httpsCallable<
  Record<string, never>,
  {
    success: boolean
    item: {
      id: string
      name: string
      rarity: GachaRarity
      type: string
      pointsValue: number | null
      ticketValue: number | null
    }
  }
>(functions, 'pullGacha')

type PullResult = {
  name: string
  rarity: GachaRarity
  type: string
  pointsValue: number | null
  ticketValue: number | null
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
  epic: 'イピック',
  legendary: 'レジェンダリー',
}

const RARITY_ORDER: Record<GachaRarity, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4,
}

export default function GachaPage() {
  const { userData, refreshUserData } = useAuth()
  const [pulling, setPulling] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [results, setResults] = useState<PullResult[]>([])
  const [history, setHistory] = useState<Array<GachaHistoryEntry & { id: string }>>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [rewardAmount, setRewardAmount] = useState(0)
  const [rewardType, setRewardType] = useState<'points' | 'ticket'>('points')
  const [pullError, setPullError] = useState<string | null>(null)

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
        limit(20)
      )
      const snap = await getDocs(q)
      const list: Array<GachaHistoryEntry & { id: string }> = []
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() as GachaHistoryEntry })
      })
      setHistory(list)
    } catch (error) {
      console.error('Error fetching gacha history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handlePull = async (count: 1 | 10) => {
    if (pulling || revealing || tickets < count) return
    setPulling(true)
    setResults([])
    setPullError(null)

    const minDelay = count === 1 ? 1500 : 3000
    const collected: PullResult[] = []

    await Promise.all([
      (async () => {
        for (let i = 0; i < count; i++) {
          try {
            const res = await pullGachaFn({} as Record<string, never>)
            collected.push(res.data.item)
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'ガチャの抽選に失敗しました'
            setPullError(msg)
            break
          }
        }
      })(),
      new Promise(resolve => setTimeout(resolve, minDelay)),
    ])

    setPulling(false)
    if (collected.length === 0) return

    setResults(collected)
    setRevealing(true)
    setTimeout(() => {
      setRevealing(false)
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
    }, 800)
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const busy = pulling || revealing

  return (
    <>
      <GachaConfetti active={results.length > 0 && !revealing} rarity={bestRarity} />

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

      <div className="min-h-screen bg-hatofes-bg pb-8">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />

        <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Ticket counter */}
          <section className="card text-center">
            <p className="text-hatofes-gray text-sm mb-1">チケット残数</p>
            <p className="text-3xl font-bold text-hatofes-white font-display">
              🎫 {tickets}<span className="text-lg text-hatofes-gray ml-1">枚</span>
            </p>
          </section>

          {/* Error */}
          {pullError && (
            <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg text-center">
              {pullError}
            </div>
          )}

          {/* Gacha Machine */}
          <section className="card text-center">
            <div className={`mx-auto w-40 h-48 rounded-t-full border-4 border-hatofes-accent-yellow bg-hatofes-dark flex items-end justify-center pb-4 relative overflow-hidden ${pulling ? 'animate-gacha-shake' : ''}`}>
              <div className={`flex gap-1 ${pulling ? 'animate-gacha-spin' : ''}`}>
                {['bg-red-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-hatofes-accent-yellow'].map((color, i) => (
                  <div key={i} className={`w-6 h-6 ${color} rounded-full opacity-80`} />
                ))}
              </div>

              {/* 1回の reveal カプセル */}
              {revealing && results.length === 1 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-16 h-16 rounded-full border-2 ${RARITY_BG[results[0].rarity]} animate-reveal flex items-center justify-center`}>
                    <span className="text-2xl">🎁</span>
                  </div>
                </div>
              )}
            </div>
            <div className="w-20 h-4 bg-hatofes-accent-orange rounded-b-lg mx-auto mb-4" />

            {/* 1回 / 10回 ボタン */}
            <div className="flex gap-2">
              <button
                onClick={() => handlePull(1)}
                disabled={busy || tickets < 1}
                className="btn-main flex-1 py-3 disabled:opacity-50 text-lg font-bold"
              >
                {pulling ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" /> 抽選中...
                  </span>
                ) : (
                  tickets < 1 ? 'チケット不足' : '1回 引く'
                )}
              </button>
              <button
                onClick={() => handlePull(10)}
                disabled={busy || tickets < 10}
                className="btn-main-10 flex-1 py-3 disabled:opacity-50 text-lg font-bold text-white"
              >
                {pulling ? '...' : '10回 引く'}
              </button>
            </div>
          </section>

          {/* 1回の結果 */}
          {results.length === 1 && !revealing && (
            <section className={`card border-2 ${RARITY_BG[results[0].rarity]} text-center`}>
              <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${RARITY_COLORS[results[0].rarity]}`}>
                {RARITY_LABELS[results[0].rarity]}
              </p>
              <h3 className="text-xl font-bold text-hatofes-white mb-2">{results[0].name}</h3>
              {results[0].type === 'points' && results[0].pointsValue && (
                <p className="text-hatofes-accent-yellow font-bold text-xl font-display">+{results[0].pointsValue}<span className="text-base ml-1">ポイント</span></p>
              )}
              {results[0].type === 'ticket' && results[0].ticketValue && (
                <p className="text-hatofes-accent-yellow font-bold text-xl font-display">+{results[0].ticketValue}<span className="text-base ml-1">チケット</span></p>
              )}
              {(results[0].type === 'badge' || results[0].type === 'coupon' || results[0].type === 'custom') && (
                <p className="text-hatofes-gray text-sm">{results[0].type}</p>
              )}
            </section>
          )}

          {/* 10回の結果リスト */}
          {results.length > 1 && !revealing && (
            <section className="card">
              <h2 className="text-hatofes-white font-bold mb-3 text-center">10回の結果</h2>
              <ul className="space-y-2">
                {[...results]
                  .sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity])
                  .map((r, i) => {
                    const isBest = i === 0
                    return (
                      <li
                        key={i}
                        className={`flex items-center justify-between p-2.5 rounded-lg ${
                          isBest ? `border ${RARITY_BG[r.rarity]}` : 'bg-hatofes-dark'
                        }`}
                      >
                        <div>
                          <p className={`text-sm ${isBest ? 'font-bold' : ''} text-hatofes-white`}>{r.name}</p>
                          <span className={`text-xs font-bold ${RARITY_COLORS[r.rarity]}`}>{RARITY_LABELS[r.rarity]}</span>
                        </div>
                        <div className="text-right">
                          {r.type === 'points' && r.pointsValue && (
                            <span className="text-xs text-hatofes-accent-yellow font-bold font-display">+{r.pointsValue}pt</span>
                          )}
                          {r.type === 'ticket' && r.ticketValue && (
                            <span className="text-xs text-hatofes-accent-yellow font-bold font-display">+{r.ticketValue}🎫</span>
                          )}
                          {isBest && <span className="block text-xs text-hatofes-accent-yellow">★ 最高レア</span>}
                        </div>
                      </li>
                    )
                  })
                }
              </ul>
            </section>
          )}

          {/* History */}
          <section className="card">
            <h2 className="font-bold text-hatofes-white mb-4">引き歴</h2>
            {historyLoading ? (
              <div className="flex justify-center py-4"><Spinner size="md" /></div>
            ) : history.length === 0 ? (
              <p className="text-hatofes-gray text-center py-4 text-sm">まだガチャを引いていません</p>
            ) : (
              <ul className="space-y-2">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between py-2 border-b border-hatofes-gray last:border-0">
                    <div>
                      <p className="text-sm text-hatofes-white">{entry.itemName}</p>
                      <p className={`text-xs font-bold ${RARITY_COLORS[entry.itemRarity]}`}>{RARITY_LABELS[entry.itemRarity]}</p>
                    </div>
                    <p className="text-xs text-hatofes-gray">
                      {entry.pulledAt?.seconds ? new Date(entry.pulledAt.seconds * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : ''}
                    </p>
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
        @keyframes gacha-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-gacha-shake { animation: gacha-shake 0.4s ease-in-out infinite; }
        @keyframes gacha-spin-inner {
          0% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0); }
        }
        .animate-gacha-spin { animation: gacha-spin-inner 0.3s ease-in-out infinite; }
        @keyframes reveal {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-reveal { animation: reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .btn-main-10 {
          background: linear-gradient(135deg, #FF4E00 0%, #FFC300 100%);
          border-radius: 0.25rem;
          font-weight: 700;
          font-family: 'din-2014', sans-serif;
          letter-spacing: 0.025em;
          transition: all 0.2s;
        }
        .btn-main-10:hover { background: linear-gradient(135deg, #e64500 0%, #e6b000 100%); }
      `}</style>
    </>
  )
}
