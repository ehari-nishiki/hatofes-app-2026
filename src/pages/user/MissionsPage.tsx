import { Link } from 'react-router-dom'
import AppHeader from '@/components/layout/AppHeader'
import { mockUser } from '@/mocks/mockData'

export default function MissionsPage() {
  const user = mockUser

  // モックミッションデータ
  const missions = [
    {
      id: 1,
      title: '鳩Tシャツデザインを応募しよう！',
      points: 20,
      status: 'available',
      deadline: '2025-02-15',
    },
    {
      id: 2,
      title: '鳩祭理解度クイズに挑戦しよう！',
      points: 20,
      status: 'available',
      deadline: '2025-02-28',
    },
    {
      id: 3,
      title: 'グッズ投票のアンケートに回答しよう！',
      points: 20,
      status: 'available',
      deadline: '2025-02-10',
    },
    {
      id: 4,
      title: 'プロフィールを完成させよう',
      points: 10,
      status: 'completed',
      deadline: null,
    },
    {
      id: 5,
      title: '初回ログインボーナス',
      points: 50,
      status: 'completed',
      deadline: null,
    },
  ]

  const availableCount = missions.filter(m => m.status === 'available').length

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
          <h1 className="text-xl font-bold text-hatofes-white">Mission</h1>
          <span className="notification-badge">{availableCount}</span>
        </div>

        {/* Available Missions */}
        <div className="card mb-6">
          <h2 className="text-sm font-bold text-hatofes-gray-light mb-4">挑戦できるミッション</h2>
          <ul className="divide-y divide-hatofes-gray">
            {missions.filter(m => m.status === 'available').map((mission) => (
              <li key={mission.id}>
                <Link
                  to={`/missions/${mission.id}`}
                  className="flex items-center justify-between py-4 hover:bg-hatofes-dark transition-colors -mx-4 px-4"
                >
                  <div className="flex-1">
                    <p className="text-hatofes-white text-sm">{mission.title}</p>
                    {mission.deadline && (
                      <p className="text-hatofes-gray text-xs mt-1">期限: {mission.deadline}</p>
                    )}
                  </div>
                  <span className="point-badge">{mission.points}pt</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Completed Missions */}
        <div className="card">
          <h2 className="text-sm font-bold text-hatofes-gray-light mb-4">達成済み</h2>
          <ul className="divide-y divide-hatofes-gray">
            {missions.filter(m => m.status === 'completed').map((mission) => (
              <li key={mission.id} className="py-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-hatofes-white text-sm line-through">{mission.title}</p>
                  </div>
                  <span className="text-hatofes-gray text-sm">+{mission.points}pt</span>
                </div>
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
