import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, limit, doc, getDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { SkeletonCard } from '@/components/ui/SkeletonLoader'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import { GachaItemDetailModal } from '@/components/ui/GachaItemDetailModal'
import { GachaPullLoading } from '@/components/gacha/GachaPullLoading'
import { GachaCardReveal } from '@/components/gacha/GachaCardReveal'
import { hapticGacha } from '@/lib/haptics'
import type { GachaHistoryEntry, GachaRarity, GachaItem } from '@/types/firestore'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

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

const RARITY_LABELS: Record<GachaRarity, string> = {
  common: 'コモン',
  uncommon: 'アンコモン',
  rare: 'レア',
  epic: 'エピック',
  legendary: 'レジェンダリー',
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
  // History & modals
  const [history, setHistory] = useState<HistoryItemWithDetails[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [rewardAmount, setRewardAmount] = useState(0)
  const [rewardType, setRewardType] = useState<'points' | 'ticket'>('points')
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItemWithDetails | null>(null)

  const tickets = userData?.gachaTickets ?? 0

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

    hapticGacha()
    setPulling(true)
    setPullCount(count)
    setResults([])
    setPullError(null)
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

      <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
        <PageHero
          eyebrow="Lucky Draw"
          title="Gacha"
          description="チケットを使ってアイテムを引き、履歴と図鑑の進み具合を確認できます。"
          aside={<PageBackLink />}
          badge={busy ? <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/60">drawing...</span> : undefined}
        />

        <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-4">
            <PageSection>
              <PageSectionTitle eyebrow="Balance" title="チケット残数" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <PageMetric label="Tickets" value={tickets.toString()} tone="accent" />
                <PageMetric label="Recent Pulls" value={history.length.toString()} />
              </div>
            </PageSection>

            {pullError ? (
              <PageSection>
                <div className="rounded-[1rem] border border-[#7f3137] bg-[#2b171a] p-4 text-sm text-[#ffb8bf]">
                  {pullError}
                </div>
              </PageSection>
            ) : null}

            <PageSection>
              <PageSectionTitle eyebrow="Draw" title="抽選" />
              <div className="space-y-3">
                <button
                  onClick={() => handlePull(1)}
                  disabled={busy || tickets < 1}
                  className="flex min-h-[84px] w-full items-center justify-between rounded-[1.15rem] bg-[#d9e4dc] px-5 py-4 text-left text-[#11161a] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[#11161a]/45">Single Draw</p>
                    <p className="mt-2 text-xl font-semibold">1回引く</p>
                  </div>
                  <span className="rounded-full bg-[#11161a]/10 px-3 py-1 text-sm font-medium">1 ticket</span>
                </button>

                <button
                  onClick={() => handlePull(10)}
                  disabled={busy || tickets < 10}
                  className="flex min-h-[84px] w-full items-center justify-between rounded-[1.15rem] bg-white/[0.06] px-5 py-4 text-left text-white transition-colors hover:bg-white/[0.09] disabled:opacity-45"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/42">Batch Draw</p>
                    <p className="mt-2 text-xl font-semibold">10回引く</p>
                  </div>
                  <span className="rounded-full bg-white/[0.08] px-3 py-1 text-sm font-medium">10 tickets</span>
                </button>
              </div>

              <Link
                to="/gacha/collection"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.04] px-4 text-sm font-medium text-white/78 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                図鑑を見る
              </Link>
            </PageSection>
          </div>

          <PageSection>
            <PageSectionTitle eyebrow="History" title="引き履歴" />
            {historyLoading ? (
              <SkeletonCard count={3} />
            ) : history.length === 0 ? (
              <PageEmptyState title="まだガチャを引いていません" description="最初の1回を引くとここに履歴が並びます。" />
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedHistoryItem(entry)}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.1rem] bg-[#0f1418] px-4 py-3 text-left transition-colors hover:bg-[#131920]"
                  >
                    {entry.imageUrl ? (
                      <img src={entry.imageUrl} alt={entry.itemName} className="h-12 w-12 rounded-[0.9rem] object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-[0.9rem] bg-white/[0.07] text-lg">
                        {entry.type === 'points' ? '💰' : entry.type === 'ticket' ? '🎫' : '🎁'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{entry.itemName}</p>
                      <p className={`mt-1 text-xs font-semibold ${RARITY_COLORS[entry.itemRarity]}`}>{RARITY_LABELS[entry.itemRarity]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/38">
                        {entry.pulledAt?.seconds ? new Date(entry.pulledAt.seconds * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </PageSection>
        </div>
      </UserPageShell>
    </>
  )
}
