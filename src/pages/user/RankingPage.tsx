import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'

interface RankedUser {
  id: string
  username: string
  grade?: number
  class?: string
  totalPoints: number
  rank: number
}

interface ClassRanking {
  classId: string
  grade: number
  className: string
  totalPoints: number
  memberCount: number
  rank: number
}

export default function RankingPage() {
  const { currentUser, userData } = useAuth()
  const [activeTab, setActiveTab] = useState<'individual' | 'class'>('individual')
  const [individualRanking, setIndividualRanking] = useState<RankedUser[]>([])
  const [classRanking, setClassRanking] = useState<ClassRanking[]>([])
  const [userRank, setUserRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        // Use cached ranking data (90% read reduction)
        const personalRankingDoc = await getDoc(doc(db, 'config', 'personalRanking'))
        const classRankingDoc = await getDoc(doc(db, 'config', 'classRanking'))

        if (personalRankingDoc.exists()) {
          const data = personalRankingDoc.data()
          const cachedRankings = data.rankings || []

          const userList: RankedUser[] = cachedRankings.map((item: any) => ({
            id: item.userId,
            username: item.username,
            grade: item.grade,
            class: item.class,
            totalPoints: item.totalPoints,
            rank: item.rank,
          }))

          setIndividualRanking(userList)

          // Find current user's rank
          if (currentUser) {
            const userInRanking = cachedRankings.find((item: any) => item.userId === currentUser.uid)
            if (userInRanking) {
              setUserRank(userInRanking.rank)
            }
          }
        }

        if (classRankingDoc.exists()) {
          const data = classRankingDoc.data()
          const cachedClassRankings = data.rankings || []

          const classRankList: ClassRanking[] = cachedClassRankings.map((item: any) => ({
            classId: item.classId,
            grade: item.grade,
            className: item.className,
            totalPoints: item.totalPoints,
            memberCount: item.memberCount,
            rank: item.rank,
          }))

          setClassRanking(classRankList)
        }
      } catch (error) {
        console.error('Error fetching rankings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRankings()
  }, [currentUser])

  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hatofes-bg pb-8">
      <AppHeader
        username={userData.username}
        grade={userData.grade}
        classNumber={userData.class}
      />

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-hatofes-white flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            ランキング
          </h1>
        </div>

        {/* User's Rank Card */}
        {userRank && (
          <div className="card mb-6 bg-gradient-to-r from-hatofes-accent-yellow/20 to-transparent border border-hatofes-accent-yellow/30">
            <p className="text-sm text-hatofes-gray mb-1">あなたの順位</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-hatofes-accent-yellow font-display">{userRank}位</span>
                <span className="text-hatofes-white">{userData.username}</span>
              </div>
              <span className="text-gradient font-bold font-display">{userData.totalPoints.toLocaleString()}pt</span>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('individual')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'individual'
                ? 'bg-hatofes-accent-yellow text-black'
                : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
            }`}
          >
            個人
          </button>
          <button
            onClick={() => setActiveTab('class')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'class'
                ? 'bg-hatofes-accent-yellow text-black'
                : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
            }`}
          >
            クラス
          </button>
        </div>

        {/* Ranking List */}
        <div className="card">
          {loading ? (
            <p className="text-hatofes-gray text-center py-8">読み込み中...</p>
          ) : activeTab === 'individual' ? (
            /* Individual Ranking */
            individualRanking.length === 0 ? (
              <p className="text-hatofes-gray text-center py-8">ランキングデータがありません</p>
            ) : (
              <ul className="space-y-2">
                {individualRanking.map((user) => (
                  <li
                    key={user.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      currentUser?.uid === user.id ? 'bg-hatofes-accent-yellow/10 border border-hatofes-accent-yellow/30' : 'bg-hatofes-dark'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm font-display ${
                      user.rank === 1 ? 'bg-yellow-500 text-black' :
                      user.rank === 2 ? 'bg-gray-400 text-black' :
                      user.rank === 3 ? 'bg-amber-700 text-white' :
                      'bg-hatofes-gray/30 text-hatofes-gray'
                    }`}>
                      {user.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${currentUser?.uid === user.id ? 'text-hatofes-accent-yellow font-bold' : 'text-hatofes-white'}`}>
                        {user.username}
                      </p>
                      {user.grade && user.class && (
                        <p className="text-xs text-hatofes-gray">{user.grade}-{user.class}</p>
                      )}
                    </div>
                    <span className="text-gradient font-bold text-sm font-display">{user.totalPoints.toLocaleString()}pt</span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            /* Class Ranking */
            classRanking.length === 0 ? (
              <p className="text-hatofes-gray text-center py-8">クラスランキングデータがありません</p>
            ) : (
              <ul className="space-y-2">
                {classRanking.map((cls) => {
                  const isUserClass = userData.grade === cls.grade && userData.class === cls.className
                  return (
                    <li
                      key={cls.classId}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        isUserClass ? 'bg-hatofes-accent-yellow/10 border border-hatofes-accent-yellow/30' : 'bg-hatofes-dark'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm font-display ${
                        cls.rank === 1 ? 'bg-yellow-500 text-black' :
                        cls.rank === 2 ? 'bg-gray-400 text-black' :
                        cls.rank === 3 ? 'bg-amber-700 text-white' :
                        'bg-hatofes-gray/30 text-hatofes-gray'
                      }`}>
                        {cls.rank}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isUserClass ? 'text-hatofes-accent-yellow' : 'text-hatofes-white'}`}>
                          {cls.grade}年{cls.className}組
                        </p>
                        <p className="text-xs text-hatofes-gray">{cls.memberCount}人</p>
                      </div>
                      <span className="text-gradient font-bold text-sm font-display">{cls.totalPoints.toLocaleString()}pt</span>
                    </li>
                  )
                })}
              </ul>
            )
          )}
        </div>

        {/* Back Button */}
        <Link to="/home" className="block mt-6">
          <div className="btn-sub w-full py-3 text-center">
            ホームに戻る
          </div>
        </Link>
      </main>
    </div>
  )
}
