import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { RoleBadge } from '@/lib/roleDisplay'

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
    <div className="min-h-screen bg-[#11161a] text-white">
      {/* Header */}
      <header className="border-b border-white/6 bg-[#161d22] px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.04em] text-white">運営パネル</h1>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-sm text-white/72">{userData.realName || userData.username}</p>
              <RoleBadge role={userData.role} department={userData.department} size="sm" />
            </div>
          </div>
          <Link to="/home" className="btn-sub text-sm px-4 py-2">
            ユーザー画面へ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Info */}
        <div className="mb-6 rounded-[1.2rem] border border-white/8 bg-white/[0.045] p-4">
          <p className="text-sm text-white/68">
            スタッフとして、通知の送信とアンケートの管理が可能です。
          </p>
        </div>

        {/* Quick Actions */}
        <h2 className="mb-4 text-lg font-semibold text-white">アクション</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menuItems.map(item => (
            <Link key={item.to} to={item.to} className="rounded-[1.2rem] bg-white/[0.045] p-5 transition-colors hover:bg-white/[0.07]">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{item.icon}</span>
                <div>
                  <p className="font-semibold text-white">{item.label}</p>
                  <p className="text-sm text-white/48">{item.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
