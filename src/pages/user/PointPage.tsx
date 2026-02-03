import { Link } from 'react-router-dom'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { usePointHistory } from '@/hooks/usePointHistory'
import { useClassPoints } from '@/hooks/useClassPoints'
import { generateClassId } from '@/lib/classUtils'

export default function PointPage() {
  const { currentUser, userData } = useAuth()
  const { history, loading: historyLoading, hasMore, loadMore } = usePointHistory(currentUser?.uid || null)

  // Get class ID and fetch class data
  const classId = userData?.grade && userData?.class
    ? generateClassId(userData.grade, userData.class)
    : null
  const { classData, loading: classLoading } = useClassPoints(classId)

  // TODO: Implement ranking calculation with Firestore aggregation
  const personalRank = null as number | null
  const totalStudents = 1500

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
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm text-hatofes-white">現在の鳩ポイント</p>
          </div>

          <div className="border border-hatofes-gray rounded-lg p-4 mb-2 bg-hatofes-dark">
            <div className="flex items-baseline justify-center">
              <span className="font-display text-5xl font-bold text-gradient">
                {userData.totalPoints.toLocaleString()}
              </span>
              <span className="text-xl ml-1 text-hatofes-gray-light">pt</span>
            </div>
          </div>

          <p className="text-xs text-hatofes-gray text-right">リアルタイム同期中</p>
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
                    <span className="text-lg ml-1 text-hatofes-gray-light">pt</span>
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
                <span className="text-lg ml-2 text-hatofes-gray-light">/ {totalStudents.toLocaleString()}人中</span>
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
              <ul className="divide-y divide-hatofes-gray">
                {history.map((item) => (
                  <li key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-hatofes-white text-sm">{getReasonLabel(item.reason)}</p>
                      <p className="text-hatofes-gray text-xs">{formatDate(item.createdAt)}</p>
                      {item.details && (
                        <p className="text-hatofes-gray text-xs mt-1">{item.details}</p>
                      )}
                    </div>
                    <span className="point-badge">+{item.points}pt</span>
                  </li>
                ))}
              </ul>

              {hasMore && (
                <button
                  onClick={loadMore}
                  className="mt-4 w-full bg-hatofes-dark rounded py-2 px-4 text-center text-sm flex items-center justify-center gap-2 text-hatofes-white hover:text-hatofes-accent-yellow transition-colors"
                >
                  <span>もっと見る</span>
                  <span>››</span>
                </button>
              )}
            </>
          )}
        </section>

        {/* Back Button */}
        <Link
          to="/home"
          className="block text-center text-hatofes-gray-light hover:text-hatofes-accent-yellow transition-colors"
        >
          ← ホームに戻る
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
