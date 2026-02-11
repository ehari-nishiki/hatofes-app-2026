import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function StaffDashboard() {
  const { userData } = useAuth()

  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
      </div>
    )
  }

  const menuItems = [
    { to: '/admin/notifications', label: '通知送信', icon: '🔔', desc: 'ユーザーへの通知を送信' },
    { to: '/admin/surveys', label: 'アンケート管理', icon: '📋', desc: 'アンケートの作成・管理' },
  ]

  return (
    <div className="min-h-screen bg-hatofes-bg">
      {/* Header */}
      <header className="bg-hatofes-dark border-b border-hatofes-gray-lighter px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-hatofes-white">スタッフパネル</h1>
            <p className="text-sm text-hatofes-gray">
              {userData.realName || userData.username} ({userData.role})
            </p>
          </div>
          <Link to="/home" className="btn-sub text-sm px-4 py-2">
            ユーザー画面へ
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-blue-400 text-sm">
            スタッフとして、通知の送信とアンケートの管理が可能です。
          </p>
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-bold text-hatofes-white mb-4">アクション</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menuItems.map(item => (
            <Link key={item.to} to={item.to} className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{item.icon}</span>
                <div>
                  <p className="font-bold text-hatofes-white">{item.label}</p>
                  <p className="text-sm text-hatofes-gray">{item.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
