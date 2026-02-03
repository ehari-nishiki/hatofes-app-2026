import { Link } from 'react-router-dom'
import AppHeader from '@/components/layout/AppHeader'
import { mockUser } from '@/mocks/mockData'

export default function NotificationsPage() {
  const user = mockUser

  // モック通知データ
  const notifications = [
    {
      id: 1,
      title: '鳩Tシャツデザインを募集しています！',
      date: '2025-02-01',
      isNew: true,
    },
    {
      id: 2,
      title: 'アイデア掲示板を使って夢を実現しよう！',
      date: '2025-01-31',
      isNew: true,
    },
    {
      id: 3,
      title: 'ミサンガ企画について',
      date: '2025-01-30',
      isNew: true,
    },
    {
      id: 4,
      title: '文化祭準備期間のスケジュールについて',
      date: '2025-01-28',
      isNew: false,
    },
    {
      id: 5,
      title: 'ポイント制度について',
      date: '2025-01-25',
      isNew: false,
    },
    {
      id: 6,
      title: 'アプリの使い方ガイド',
      date: '2025-01-20',
      isNew: false,
    },
  ]

  const newCount = notifications.filter(n => n.isNew).length

  return (
    <div className="min-h-screen bg-hatofes-bg pb-8">
      <AppHeader
        username={user.username}
        grade={user.grade}
        classNumber={user.class}
      />

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-hatofes-white">新着通知</h1>
          <span className="notification-badge">{newCount}</span>
        </div>

        {/* Notification List */}
        <div className="card">
          <ul className="divide-y divide-hatofes-gray">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  to={`/notifications/${notification.id}`}
                  className="flex items-center justify-between py-4 hover:bg-hatofes-dark transition-colors -mx-4 px-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {notification.isNew && (
                        <span className="w-2 h-2 bg-hatofes-accent-orange rounded-full" />
                      )}
                      <p className="text-hatofes-white text-sm">{notification.title}</p>
                    </div>
                    <p className="text-hatofes-gray text-xs mt-1">{notification.date}</p>
                  </div>
                  <ChevronRightIcon />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Back Button */}
        <Link
          to="/home"
          className="block mt-6 text-center text-hatofes-gray-light hover:text-hatofes-accent-yellow transition-colors"
        >
          ← ホームに戻る
        </Link>
      </main>
    </div>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-5 h-5 text-hatofes-gray" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
