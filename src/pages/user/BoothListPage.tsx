import { useEffect, useState } from 'react'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { Toast, useToast } from '@/components/ui/Toast'
import { hapticLight } from '@/lib/haptics'
import type { Booth, BoothCategory, BoothReview } from '@/types/firestore'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

type BoothWithId = Booth & { id: string }
type ReviewWithId = BoothReview & { id: string }

const CATEGORY_LABELS: Record<BoothCategory, string> = {
  food: '模擬店',
  game: 'ゲーム',
  exhibition: '展示',
  stage: 'ステージ',
  other: 'その他',
}

const CATEGORY_ICONS: Record<BoothCategory, string> = {
  food: '🍜',
  game: '🎮',
  exhibition: '🎨',
  stage: '🎤',
  other: '📌',
}

export default function BoothListPage() {
  const { currentUser, userData } = useAuth()
  const [booths, setBooths] = useState<BoothWithId[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<BoothCategory | 'all'>('all')
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [reviews, setReviews] = useState<Record<string, ReviewWithId[]>>({})
  const [userReviews, setUserReviews] = useState<Set<string>>(new Set())
  const [reviewingBooth, setReviewingBooth] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    const fetchBooths = async () => {
      try {
        const boothsQuery = query(collection(db, 'booths'), where('isActive', '==', true), orderBy('classId', 'asc'))
        const snapshot = await getDocs(boothsQuery)
        setBooths(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BoothWithId)))
      } catch (error) {
        console.error('Error fetching booths:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooths()
  }, [])

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const reviewsQuery = query(collection(db, 'boothReviews'), orderBy('createdAt', 'desc'))
        const snapshot = await getDocs(reviewsQuery)
        const reviewMap: Record<string, ReviewWithId[]> = {}
        const userReviewedBooths = new Set<string>()

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as BoothReview
          const review = { id: docSnap.id, ...data } as ReviewWithId
          if (!reviewMap[data.boothId]) reviewMap[data.boothId] = []
          reviewMap[data.boothId].push(review)
          if (currentUser && data.userId === currentUser.uid) userReviewedBooths.add(data.boothId)
        })

        setReviews(reviewMap)
        setUserReviews(userReviewedBooths)
      } catch (error) {
        console.error('Error fetching reviews:', error)
      }
    }

    fetchReviews()
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    const savedFavorites = localStorage.getItem(`booth-favorites-${currentUser.uid}`)
    if (savedFavorites) setFavorites(new Set(JSON.parse(savedFavorites)))
  }, [currentUser])

  const toggleFavorite = (boothId: string) => {
    if (!currentUser) return
    const nextFavorites = new Set(favorites)
    if (nextFavorites.has(boothId)) nextFavorites.delete(boothId)
    else nextFavorites.add(boothId)
    setFavorites(nextFavorites)
    localStorage.setItem(`booth-favorites-${currentUser.uid}`, JSON.stringify([...nextFavorites]))
  }

  const handleSubmitReview = async (boothId: string) => {
    if (!currentUser || !userData || reviewRating === 0 || submittingReview) return
    setSubmittingReview(true)
    try {
      await addDoc(collection(db, 'boothReviews'), {
        boothId,
        userId: currentUser.uid,
        username: userData.username,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
        createdAt: serverTimestamp(),
      })
      setUserReviews((prev) => new Set([...prev, boothId]))
      setReviewingBooth(null)
      setReviewRating(0)
      setReviewComment('')
      showToast('レビューを投稿しました', 'success')
    } catch (error) {
      console.error('Error submitting review:', error)
      showToast('レビューの投稿に失敗しました', 'error')
    } finally {
      setSubmittingReview(false)
    }
  }

  const getAverageRating = (boothId: string) => {
    const boothReviews = reviews[boothId]
    if (!boothReviews?.length) return 0
    return boothReviews.reduce((sum, review) => sum + review.rating, 0) / boothReviews.length
  }

  const filteredBooths = booths.filter((booth) => {
    if (selectedCategory !== 'all' && booth.category !== selectedCategory) return false
    if (selectedFloor !== 'all' && booth.floor !== selectedFloor) return false
    if (showFavoritesOnly && !favorites.has(booth.id)) return false
    if (searchQuery) {
      const normalized = searchQuery.toLowerCase()
      return booth.name.toLowerCase().includes(normalized) ||
        booth.classId.toLowerCase().includes(normalized) ||
        booth.location.toLowerCase().includes(normalized) ||
        (booth.description?.toLowerCase().includes(normalized) ?? false)
    }
    return true
  })

  const floors = [...new Set(booths.map((booth) => booth.floor).filter((floor): floor is number => floor !== undefined))].sort()

  if (loading || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      {toast ? <Toast message={toast.message} type={toast.type} onClose={hideToast} /> : null}

      <PageHero
        eyebrow="Festival Map"
        title="Booths"
        description="出展ブースを検索し、カテゴリや階数で絞り込みながら、お気に入りや口コミも整理できます。"
        aside={<PageBackLink />}
      />

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-4">
          <PageSection>
            <PageSectionTitle eyebrow="Search" title="絞り込み" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="クラス名・場所で検索"
              className="h-11 w-full rounded-[0.95rem] border border-white/8 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/28"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>すべて</FilterChip>
              {(Object.keys(CATEGORY_LABELS) as BoothCategory[]).map((category) => (
                <FilterChip key={category} active={selectedCategory === category} onClick={() => setSelectedCategory(category)}>
                  {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}
                </FilterChip>
              ))}
            </div>
            {floors.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <FilterChip active={selectedFloor === 'all'} onClick={() => setSelectedFloor('all')}>全フロア</FilterChip>
                {floors.map((floor) => (
                  <FilterChip key={floor} active={selectedFloor === floor} onClick={() => setSelectedFloor(floor)}>{floor}F</FilterChip>
                ))}
              </div>
            ) : null}
          </PageSection>

          <PageSection>
            <PageSectionTitle eyebrow="Summary" title="現在の結果" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <PageMetric label="Filtered" value={filteredBooths.length.toString()} />
              <PageMetric label="Favorites" value={favorites.size.toString()} tone="soft" />
            </div>
            <button
              onClick={() => setShowFavoritesOnly((prev) => !prev)}
              className={`mt-4 inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-medium ${
                showFavoritesOnly ? 'bg-[#2b171a] text-[#ffb8bf]' : 'border border-white/8 bg-white/[0.04] text-white/78'
              }`}
            >
              {showFavoritesOnly ? 'お気に入りのみ表示中' : 'お気に入りだけを見る'}
            </button>
          </PageSection>
        </div>

        <PageSection>
          <PageSectionTitle
            eyebrow="All Booths"
            title="ブース一覧"
            meta={<span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/58">{filteredBooths.length} booths</span>}
          />
          {filteredBooths.length === 0 ? (
            <PageEmptyState title="該当するブースがありません" />
          ) : (
            <div className="space-y-3">
              {filteredBooths.map((booth) => {
                const avg = getAverageRating(booth.id)
                const count = reviews[booth.id]?.length || 0
                return (
                  <div key={booth.id} className="rounded-[1.15rem] bg-[#0f1418] p-4">
                    <div className="flex gap-4">
                      {booth.imageUrl ? (
                        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-[0.95rem] bg-black/18">
                          <img src={booth.imageUrl} alt={booth.name} className="h-full w-full object-cover" />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/58">{booth.classId}</span>
                              <span className="text-sm">{CATEGORY_ICONS[booth.category]} {CATEGORY_LABELS[booth.category]}</span>
                            </div>
                            <h3 className="truncate text-sm font-semibold text-white">{booth.name}</h3>
                          </div>
                          <button onClick={() => toggleFavorite(booth.id)} className="text-lg">
                            {favorites.has(booth.id) ? '❤️' : '🤍'}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-white/42">
                          {booth.location}{booth.floor ? ` / ${booth.floor}F` : ''}
                        </p>
                        {booth.description ? <p className="mt-2 text-sm text-white/62">{booth.description}</p> : null}
                        {count > 0 ? (
                          <p className="mt-2 text-xs text-white/52">★ {avg.toFixed(1)} ({count})</p>
                        ) : null}
                        {currentUser && !userReviews.has(booth.id) ? (
                          <button
                            onClick={() => {
                              hapticLight()
                              setReviewingBooth(booth.id)
                              setReviewRating(0)
                              setReviewComment('')
                            }}
                            className="mt-2 text-xs text-white/68 transition-colors hover:text-white"
                          >
                            口コミを書く
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {reviewingBooth === booth.id ? (
                      <div className="mt-4 border-t border-white/8 pt-4">
                        <div className="mb-3 flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => { hapticLight(); setReviewRating(star) }}
                              className={`text-xl ${star <= reviewRating ? 'text-[#f7d37c]' : 'text-white/18'}`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={reviewComment}
                          onChange={(event) => setReviewComment(event.target.value)}
                          placeholder="コメント（任意）"
                          maxLength={100}
                          className="h-11 w-full rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/28"
                        />
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => setReviewingBooth(null)} className="flex-1 rounded-[0.9rem] border border-white/8 bg-white/[0.04] py-2.5 text-sm text-white/72">キャンセル</button>
                          <button
                            onClick={() => handleSubmitReview(booth.id)}
                            disabled={reviewRating === 0 || submittingReview}
                            className="flex-1 rounded-[0.9rem] bg-[#d9e4dc] py-2.5 text-sm font-medium text-[#11161a] disabled:opacity-45"
                          >
                            {submittingReview ? '送信中...' : '投稿'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </PageSection>
      </div>
    </UserPageShell>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-white text-[#11161a]' : 'bg-[#0f1418] text-white/64 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
