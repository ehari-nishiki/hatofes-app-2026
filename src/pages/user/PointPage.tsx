import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getCountFromServer, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { usePointHistory } from '@/hooks/usePointHistory'
import { useClassPoints } from '@/hooks/useClassPoints'
import { generateClassId } from '@/lib/classUtils'
import { AnimatedNumber } from '@/components/ui/PageLoader'

export default function PointPage() {
  const { currentUser, userData } = useAuth()
  const { history, loading: historyLoading, hasMore, loadMore, refresh } = usePointHistory(currentUser?.uid || null)

  // Get class ID and fetch class data
  const classId = userData?.grade && userData?.class
    ? generateClassId(userData.grade, userData.class)
    : null
  const { classData, loading: classLoading } = useClassPoints(classId)

  const [personalRank, setPersonalRank] = useState<number | null>(null)
  const [totalUsers, setTotalUsers] = useState<number | null>(null)

  // Fetch rank using cache (optimized)
  useEffect(() => {
    if (!currentUser || !userData) return
    const fetchRank = async () => {
      try {
        // Try to get ranking from cache first
        const rankingCacheDoc = await getDoc(doc(db, 'config', 'personalRanking'))

        if (rankingCacheDoc.exists()) {
          const cachedRankings = rankingCacheDoc.data().rankings || []
          const rank = cachedRankings.findIndex((r: any) => r.userId === currentUser.uid) + 1
          if (rank > 0) {
            setPersonalRank(rank)
            setTotalUsers(cachedRankings.length)
            return
          }
        }

        // Fallback: calculate rank directly if cache miss
        const higherSnap = await getCountFromServer(
          query(collection(db, 'users'), where('totalPoints', '>', userData.totalPoints))
        )
        setPersonalRank(higherSnap.data().count + 1)
        const totalSnap = await getCountFromServer(query(collection(db, 'users')))
        setTotalUsers(totalSnap.data().count)
      } catch (error) {
        console.error('Error fetching rank:', error)
      }
    }
    fetchRank()
  }, [currentUser, userData])

  // Refresh point history when total points change
  useEffect(() => {
    if (userData?.totalPoints !== undefined) {
      refresh()
    }
  }, [userData?.totalPoints, refresh])

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

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Personal Points */}
        <section className="card">
          <p className="text-lg text-hatofes-white text-center mb-3 font-bold">現在の鳩ポイント</p>

          <div
            className="rounded-lg p-4 mb-2"
            style={{
              background: 'linear-gradient(135deg, rgba(255,195,0,0.15), rgba(255,78,0,0.15))',
              border: '2px solid transparent',
              backgroundImage: 'linear-gradient(#0d0d0d, #0d0d0d), linear-gradient(135deg, #FFC300, #FF4E00)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
            }}
          >
            <div className="flex items-baseline justify-center">
              <span className="font-display text-5xl font-bold text-gradient">
                <AnimatedNumber value={userData.totalPoints} duration={1200} />
              </span>
              <span className="text-xl ml-1 text-hatofes-gray-light font-display">pt</span>
            </div>
          </div>

          <p className="text-xs text-hatofes-gray text-right flex items-center justify-end gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            リアルタイム同期中
          </p>
        </section>

        {/* Class Points */}
        {userData.role === 'student' && classData && (
          <section className="card">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-hatofes-white">{userData.grade}-{userData.class}</p>
            </div>

            <div className="border border-hatofes-gray rounded-lg p-4 mb-2 bg-hatofes-dark">
              <div className="flex items-baseline justify-center">
                {classLoading ? (
                  <span className="text-hatofes-gray">読み込み中...</span>
                ) : (
                  <>
                    <span className="font-display text-4xl font-bold text-hatofes-white">
                      {classData.totalPoints.toLocaleString()}
                    </span>
                    <span className="text-lg ml-1 text-hatofes-gray-light font-display">pt</span>
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-hatofes-gray text-right">
              クラス合計 {classData.memberCount > 0 && `/ ${classData.memberCount}人`}
            </p>
          </section>
        )}

        {/* Ranking */}
        <section className="card">
          <p className="text-sm text-hatofes-white mb-2">順位</p>
          <div className="flex items-baseline justify-center py-4">
            {personalRank !== null ? (
              <>
                <span className="font-display text-5xl font-bold text-gradient">
                  {personalRank.toLocaleString()}
                </span>
                <span className="text-lg ml-2 text-hatofes-gray-light font-display">/ {(totalUsers ?? 0).toLocaleString()}人中</span>
              </>
            ) : (
              <span className="text-hatofes-gray">ランキング計算中...</span>
            )}
          </div>
          <Link
            to="/ranking"
            className="block bg-hatofes-dark rounded py-2 px-4 text-center text-sm text-hatofes-white hover:text-hatofes-accent-yellow transition-colors"
          >
            ランキングを見る →
          </Link>
        </section>

        {/* Point History */}
        <section className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-hatofes-white">履歴</h2>
          </div>

          {historyLoading ? (
            <p className="text-sm text-hatofes-gray text-center py-4">読み込み中...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-hatofes-gray text-center py-4">まだポイント履歴がありません</p>
          ) : (
            <>
              <ul className="space-y-2">
                {history.map((item) => (
                  <li key={item.id} className="py-3 px-3 flex items-center justify-between rounded-lg bg-hatofes-dark">
                    <div>
                      <p className="text-hatofes-white text-sm font-medium">{getReasonLabel(item.reason)}</p>
                      <p className="text-hatofes-gray text-xs font-display">{formatDate(item.createdAt)}</p>
                      {item.details && (
                        <p className="text-hatofes-gray text-xs mt-1">{item.details}</p>
                      )}
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-sm font-bold font-display text-white"
                      style={{
                        background: item.points >= 0
                          ? 'linear-gradient(90deg, #FFC300, #FF4E00)'
                          : 'linear-gradient(90deg, #ef4444, #dc2626)',
                      }}
                    >
                      {item.points >= 0 ? '+' : ''}{item.points}pt
                    </span>
                  </li>
                ))}
              </ul>

              {hasMore && (
                <button
                  onClick={loadMore}
                  className="mt-4 w-full rounded-lg py-2.5 px-4 text-center text-sm flex items-center justify-center gap-2 text-hatofes-white border border-hatofes-gray hover:border-hatofes-accent-yellow hover:text-hatofes-accent-yellow transition-colors"
                >
                  <span className="font-din">Show more</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </>
          )}
        </section>

        {/* Back Button */}
        <Link to="/home" className="block">
          <div className="btn-sub w-full py-3 text-center">
            ホームに戻る
          </div>
        </Link>
      </main>
    </div>
  )
}

function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    login_bonus: 'ログインボーナス',
    survey: 'アンケート回答',
    admin_grant: '運営からの付与',
    game_result: 'ゲーム結果',
  }
  return labels[reason] || reason
}

function formatDate(timestamp: { seconds: number; nanoseconds: number }): string {
  const date = new Date(timestamp.seconds * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'たった今'
  if (diffMins < 60) return `${diffMins}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 7) return `${diffDays}日前`

  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}
