import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import AppHeader from '@/components/layout/AppHeader'
import { Spinner } from '@/components/ui/Spinner'
import type { Booth, BoothCategory } from '@/types/firestore'

type BoothWithId = Booth & { id: string }

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

  // Fetch booths
  useEffect(() => {
    const fetchBooths = async () => {
      try {
        const boothsQuery = query(
          collection(db, 'booths'),
          where('isActive', '==', true),
          orderBy('classId', 'asc')
        )
        const snapshot = await getDocs(boothsQuery)
        const boothList: BoothWithId[] = []
        snapshot.forEach((doc) => {
          boothList.push({ id: doc.id, ...doc.data() } as BoothWithId)
        })
        setBooths(boothList)
      } catch (error) {
        console.error('Error fetching booths:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooths()
  }, [])

  // Load favorites from local storage
  useEffect(() => {
    if (!currentUser) return
    const savedFavorites = localStorage.getItem(`booth-favorites-${currentUser.uid}`)
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)))
    }
  }, [currentUser])

  // Save favorites to local storage
  const toggleFavorite = (boothId: string) => {
    if (!currentUser) return
    const newFavorites = new Set(favorites)
    if (newFavorites.has(boothId)) {
      newFavorites.delete(boothId)
    } else {
      newFavorites.add(boothId)
    }
    setFavorites(newFavorites)
    localStorage.setItem(`booth-favorites-${currentUser.uid}`, JSON.stringify([...newFavorites]))
  }

  // Filter booths
  const filteredBooths = booths.filter((booth) => {
    if (selectedCategory !== 'all' && booth.category !== selectedCategory) return false
    if (selectedFloor !== 'all' && booth.floor !== selectedFloor) return false
    if (showFavoritesOnly && !favorites.has(booth.id)) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        booth.name.toLowerCase().includes(query) ||
        booth.classId.toLowerCase().includes(query) ||
        booth.location.toLowerCase().includes(query) ||
        (booth.description?.toLowerCase().includes(query) ?? false)
      )
    }
    return true
  })

  // Get unique floors
  const floors = [...new Set(booths.map((b) => b.floor).filter((f): f is number => f !== undefined))].sort()

  if (loading) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hatofes-bg pb-20">
      <AppHeader
        username={userData?.username || ''}
        grade={userData?.grade}
        classNumber={userData?.class}
      />

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/home" className="p-2 -ml-2 text-hatofes-gray hover:text-hatofes-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-hatofes-white font-display">ブース一覧</h1>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="クラス名・場所で検索..."
            className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-3 text-hatofes-white placeholder-hatofes-gray"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-hatofes-accent-yellow text-black'
                : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
            }`}
          >
            すべて
          </button>
          {(Object.keys(CATEGORY_LABELS) as BoothCategory[]).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-hatofes-accent-yellow text-black'
                  : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
              }`}
            >
              {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>

        {/* Floor filter */}
        {floors.length > 0 && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedFloor('all')}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                selectedFloor === 'all'
                  ? 'bg-hatofes-accent-orange text-white'
                  : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
              }`}
            >
              全フロア
            </button>
            {floors.map((floor) => (
              <button
                key={floor}
                onClick={() => setSelectedFloor(floor)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedFloor === floor
                    ? 'bg-hatofes-accent-orange text-white'
                    : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
                }`}
              >
                {floor}F
              </button>
            ))}
          </div>
        )}

        {/* Favorites toggle */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-hatofes-gray">{filteredBooths.length}件のブース</span>
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
              showFavoritesOnly
                ? 'bg-red-500/20 text-red-400'
                : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
            }`}
          >
            <span>{showFavoritesOnly ? '❤️' : '🤍'}</span>
            お気に入り
          </button>
        </div>

        {/* Booth list */}
        {filteredBooths.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-hatofes-gray">該当するブースがありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBooths.map((booth) => (
              <div
                key={booth.id}
                className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all"
              >
                <div className="flex gap-4">
                  {booth.imageUrl && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-hatofes-dark">
                      <img
                        src={booth.imageUrl}
                        alt={booth.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{CATEGORY_ICONS[booth.category]}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-hatofes-dark text-hatofes-gray">
                            {booth.classId}
                          </span>
                        </div>
                        <h3 className="font-bold text-hatofes-white truncate">{booth.name}</h3>
                      </div>
                      <button
                        onClick={() => toggleFavorite(booth.id)}
                        className="p-1 text-lg"
                      >
                        {favorites.has(booth.id) ? '❤️' : '🤍'}
                      </button>
                    </div>
                    <p className="text-sm text-hatofes-gray mt-1">
                      📍 {booth.location}
                      {booth.floor && ` (${booth.floor}F)`}
                    </p>
                    {booth.description && (
                      <p className="text-xs text-hatofes-gray mt-1 line-clamp-2">{booth.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
