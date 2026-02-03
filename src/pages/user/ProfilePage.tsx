import { Link } from 'react-router-dom'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/firebase'

export default function ProfilePage() {
  const { userData } = useAuth()

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      // The auth state change will be handled by AuthContext
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

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
        {/* Profile Header */}
        <section className="card text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-hatofes-accent-yellow to-hatofes-accent-orange flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
            {userData.username.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold text-hatofes-white mb-2">{userData.username}</h1>
          <p className="text-hatofes-gray-light">
            {userData.role === 'teacher' || userData.role === 'staff'
              ? userData.role === 'teacher' ? '教員' : '職員'
              : `${userData.grade}年${userData.class}組 ${userData.studentNumber}番`}
          </p>
        </section>

        {/* Stats */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">統計</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-hatofes-white">総獲得ポイント</span>
              <span className="text-gradient font-bold font-display text-xl">{userData.totalPoints.toLocaleString()}pt</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-hatofes-white">登録日</span>
              <span className="text-hatofes-gray-light">
                {new Date(userData.createdAt.seconds * 1000).toLocaleDateString('ja-JP')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-hatofes-white">最終ログイン</span>
              <span className="text-hatofes-gray-light">{userData.lastLoginDate}</span>
            </div>
          </div>
        </section>

        {/* Account Info */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">アカウント情報</h2>
          <div className="space-y-4">
            <div>
              <p className="text-hatofes-gray-light text-sm mb-1">メールアドレス</p>
              <p className="text-hatofes-white">{userData.email}</p>
            </div>
            <div>
              <p className="text-hatofes-gray-light text-sm mb-1">ユーザーネーム</p>
              <p className="text-hatofes-white">{userData.username}</p>
            </div>
            <div>
              <p className="text-hatofes-gray-light text-sm mb-1">所属</p>
              <p className="text-hatofes-white">
                {userData.role === 'teacher' ? '教員' : userData.role === 'staff' ? '職員' : `${userData.grade}年${userData.class}組`}
              </p>
            </div>
            <div>
              <p className="text-hatofes-gray-light text-sm mb-1">権限</p>
              <p className="text-hatofes-white capitalize">{userData.role}</p>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="space-y-3">
          <button className="btn-sub w-full py-3 rounded-full" disabled>
            プロフィール画像を変更
          </button>
          <button className="btn-sub w-full py-3 rounded-full" disabled>
            設定
          </button>
          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
          >
            ログアウト
          </button>
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
