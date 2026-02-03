import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { usePointHistory } from '@/hooks/usePointHistory'
import { awardLoginBonus } from '@/lib/pointService'
import { PointRewardModal } from '@/components/ui/PointRewardModal'

export default function HomePage() {
  const { currentUser, userData } = useAuth()
  const { history, loading: historyLoading } = usePointHistory(currentUser?.uid || null)
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [rewardPoints, setRewardPoints] = useState(0)
  const [rewardReason, setRewardReason] = useState('')

  // Check and award login bonus on mount
  useEffect(() => {
    const handleLoginBonus = async () => {
      if (!currentUser || !userData) return

      try {
        const result = await awardLoginBonus()
        if (result.success && result.points) {
          setRewardPoints(result.points)
          setRewardReason('本日のログインボーナス')
          setShowRewardModal(true)
        }
      } catch (error) {
        console.error('Error handling login bonus:', error)
      }
    }

    handleLoginBonus()
  }, [currentUser, userData])

  const notifications = [
    { id: 1, text: '鳩Tシャツデザインを募集しています！' },
    { id: 2, text: 'アイデア掲示板を使って夢を実現しよう！' },
    { id: 3, text: 'ミサンガ企画について' },
  ]

  const missions = [
    { id: 1, text: '鳩Tシャツデザインを応募しよう！', points: 20 },
    { id: 2, text: '鳩祭理解度クイズに挑戦しよう！', points: 20 },
    { id: 3, text: 'グッズ投票のアンケートに回答しよう！', points: 20 },
  ]

  // Show loading state
  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
      </div>
    )
  }

  return (
    <>
      {/* Login Bonus Reward Modal */}
      <PointRewardModal
        isOpen={showRewardModal}
        points={rewardPoints}
        reason={rewardReason}
        onClose={() => setShowRewardModal(false)}
      />

      <div className="min-h-screen bg-hatofes-bg pb-20">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />

        <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Point Meter - Clickable */}
          <Link to="/point" className="block">
            <section className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm text-hatofes-white">現在の鳩ポイント</p>
                <span className="text-hatofes-gray text-xs">タップで詳細 →</span>
              </div>

              <div className="border border-hatofes-gray rounded-lg p-4 mb-2 bg-hatofes-dark">
                <div className="flex items-baseline justify-center">
                  <span className="font-display text-5xl font-bold text-gradient">
                    {userData.totalPoints.toLocaleString()}
                  </span>
                  <span className="text-xl ml-1 text-hatofes-gray-light font-display">pt</span>
                </div>
              </div>

              <p className="text-xs text-hatofes-gray text-right">リアルタイム同期中</p>
            </section>
          </Link>

        {/* Notifications */}
        <section className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-hatofes-white">新着通知</h2>
            <span className="notification-badge">5</span>
          </div>

          <ul className="space-y-3">
            {notifications.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 border-b border-hatofes-gray last:border-0">
                <span className="text-sm text-hatofes-white font-bold">{item.text}</span>
                <ChevronRightIcon />
              </li>
            ))}
          </ul>

          <Link to="/notifications" className="block mt-4">
            <div className="bg-hatofes-dark rounded py-2 px-4 text-center text-sm flex items-center justify-center text-hatofes-white hover:text-hatofes-accent-yellow transition-colors font-display">
              View More
            </div>
          </Link>
        </section>

        {/* Missions */}
        <section className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-hatofes-white">Mission</h2>
            <span className="notification-badge">5</span>
          </div>

          <ul className="space-y-3">
            {missions.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 border-b border-hatofes-gray last:border-0">
                <span className="text-sm text-hatofes-white">{item.text}</span>
                <span className="point-badge">{item.points}pt</span>
              </li>
            ))}
          </ul>

          <Link to="/missions" className="block mt-4">
            <div className="bg-hatofes-dark rounded py-2 px-4 text-center text-sm flex items-center justify-center text-hatofes-white hover:text-hatofes-accent-yellow transition-colors font-display">
              View More
            </div>
          </Link>
        </section>

        {/* Recent Points */}
        <section className="card">
          <h2 className="font-bold mb-4 text-hatofes-white">最近のポイント履歴</h2>
          {historyLoading ? (
            <p className="text-sm text-hatofes-gray text-center py-4">読み込み中...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-hatofes-gray text-center py-4">まだポイント履歴がありません</p>
          ) : (
            <ul className="space-y-2">
              {history.slice(0, 3).map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2 border-b border-hatofes-gray last:border-0">
                  <div>
                    <p className="text-sm text-hatofes-white">{getReasonLabel(item.reason)}</p>
                    <p className="text-xs text-hatofes-gray font-display">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <span className="text-gradient font-bold">+{item.points}pt</span>
                </li>
              ))}
            </ul>
          )}

          <Link to="/point" className="block mt-4">
            <div className="bg-hatofes-dark rounded py-2 px-4 text-center text-sm flex items-center justify-center text-hatofes-white hover:text-hatofes-accent-yellow transition-colors font-display">
              View More
            </div>
          </Link>
        </section>
        </main>
      </div>
    </>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4 text-hatofes-gray" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
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

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}
