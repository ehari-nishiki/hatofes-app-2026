import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { GachaItemDetailModal } from '@/components/ui/GachaItemDetailModal'
import type { GachaHistoryEntry, GachaItem, GachaRarity } from '@/types/firestore'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

const RARITY_COLORS: Record<GachaRarity, string> = {
  common: 'text-white/62',
  uncommon: 'text-[#bde5c5]',
  rare: 'text-[#bfd5ff]',
  epic: 'text-[#d6bcff]',
  legendary: 'text-[#f7d37c]',
}

const RARITY_SURFACE: Record<GachaRarity, string> = {
  common: 'bg-[#0f1418]',
  uncommon: 'bg-[#18251d]',
  rare: 'bg-[#162232]',
  epic: 'bg-[#251933]',
  legendary: 'bg-[#2d2818]',
}

const RARITY_LABELS: Record<GachaRarity, string> = {
  common: 'コモン',
  uncommon: 'アンコモン',
  rare: 'レア',
  epic: 'エピック',
  legendary: 'レジェンダリー',
}

const RARITY_ORDER: Record<GachaRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

export default function GachaCollectionPage() {
  const { currentUser, userData } = useAuth()
  const [items, setItems] = useState<(GachaItem & { id: string })[]>([])
  const [obtainedItemIds, setObtainedItemIds] = useState<Set<string>>(new Set())
  const [historyByItemId, setHistoryByItemId] = useState<Map<string, GachaHistoryEntry>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<(GachaItem & { id: string }) | null>(null)

  useEffect(() => {
    if (!currentUser) return

    const fetchData = async () => {
      try {
        const itemsQuery = query(
          collection(db, 'gachaItems'),
          where('isActive', '==', true),
          orderBy('rarity')
        )
        const itemsSnapshot = await getDocs(itemsQuery)
        const fetchedItems = itemsSnapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        })) as (GachaItem & { id: string })[]

        const historyQuery = query(
          collection(db, 'gachaHistory'),
          where('userId', '==', currentUser.uid)
        )
        const historySnapshot = await getDocs(historyQuery)

        const obtained = new Set<string>()
        const historyMap = new Map<string, GachaHistoryEntry>()
        historySnapshot.docs.forEach((docSnap) => {
          const entry = docSnap.data() as GachaHistoryEntry
          obtained.add(entry.itemId)
          const existing = historyMap.get(entry.itemId)
          if (!existing || (entry.pulledAt && existing.pulledAt && entry.pulledAt.seconds > existing.pulledAt.seconds)) {
            historyMap.set(entry.itemId, { ...entry, id: docSnap.id })
          }
        })

        setItems(fetchedItems)
        setObtainedItemIds(obtained)
        setHistoryByItemId(historyMap)
      } catch (error) {
        console.error('Failed to fetch gacha collection:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentUser])

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]),
    [items]
  )

  const obtainedCount = useMemo(
    () => items.filter((item) => obtainedItemIds.has(item.id)).length,
    [items, obtainedItemIds]
  )

  if (loading || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <Spinner />
      </div>
    )
  }

  const totalCount = items.length
  const completionPercent = totalCount > 0 ? Math.round((obtainedCount / totalCount) * 100) : 0

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      <PageHero
        eyebrow="Collection"
        title="Gacha Atlas"
        description="獲得済みアイテムと未入手アイテムを一覧で見て、図鑑の完成度を確認できます。"
        aside={<PageBackLink to="/gacha" label="ガチャへ戻る" />}
      />

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <PageSection>
          <PageSectionTitle eyebrow="Progress" title="図鑑進捗" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <PageMetric label="Collected" value={obtainedCount.toString()} />
            <PageMetric label="Completion" value={`${completionPercent}%`} tone="accent" />
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#d9e4dc] transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </PageSection>

        <PageSection>
          <PageSectionTitle
            eyebrow="All Items"
            title="アイテム一覧"
            meta={<span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/58">{obtainedCount}/{totalCount}</span>}
          />
          {sortedItems.length === 0 ? (
            <PageEmptyState title="ガチャアイテムがまだありません" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sortedItems.map((item) => {
                const isObtained = obtainedItemIds.has(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => { if (isObtained) setSelectedItem(item) }}
                    disabled={!isObtained}
                    className={`rounded-[1.1rem] p-3 text-left transition-transform ${
                      isObtained ? `${RARITY_SURFACE[item.rarity]} hover:-translate-y-0.5` : 'bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex h-24 items-center justify-center overflow-hidden rounded-[0.95rem] bg-black/18">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={isObtained ? item.name : '???'}
                          className={`h-full w-full object-cover ${isObtained ? '' : 'brightness-0 opacity-25'}`}
                        />
                      ) : (
                        <span className="text-3xl text-white/38">{isObtained ? '🎁' : '?'}</span>
                      )}
                    </div>
                    <p className={`mt-3 line-clamp-2 text-sm font-medium ${isObtained ? 'text-white' : 'text-white/28'}`}>
                      {isObtained ? item.name : '???'}
                    </p>
                    <p className={`mt-1 text-xs font-semibold ${isObtained ? RARITY_COLORS[item.rarity] : 'text-white/24'}`}>
                      {isObtained ? RARITY_LABELS[item.rarity] : '???'}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </PageSection>
      </div>

      {selectedItem ? (
        <GachaItemDetailModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={{
            name: selectedItem.name,
            description: selectedItem.description,
            rarity: selectedItem.rarity,
            type: selectedItem.type,
            imageUrl: selectedItem.imageUrl,
            pointsValue: selectedItem.pointsValue,
            ticketValue: selectedItem.ticketValue,
            pulledAt: historyByItemId.get(selectedItem.id)?.pulledAt as unknown as { seconds: number } | undefined,
          }}
        />
      ) : null}
    </UserPageShell>
  )
}
