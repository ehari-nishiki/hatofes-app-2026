import { useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { auth, db } from '@/lib/firebase'

export default function ProfilePage() {
  const { currentUser, userData, refreshUserData } = useAuth()
  const [editingRealName, setEditingRealName] = useState(false)
  const [realName, setRealName] = useState('')
  const [savingRealName, setSavingRealName] = useState(false)

  // Generate short user ID from Firebase UID
  const getUserId = () => {
    if (!currentUser) return ''
    return currentUser.uid.substring(0, 8).toUpperCase()
  }

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      // The auth state change will be handled by AuthContext
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleSaveRealName = async () => {
    if (!currentUser || !realName.trim()) return

    setSavingRealName(true)
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        realName: realName.trim(),
      })
      await refreshUserData?.()
      setEditingRealName(false)
    } catch (error) {
      console.error('Error saving real name:', error)
    } finally {
      setSavingRealName(false)
    }
  }

  const isStaffOrAdmin = userData?.role === 'staff' || userData?.role === 'admin'

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
            {userData.role === 'teacher'
              ? '教員'
              : (userData.grade && userData.class)
                ? `${userData.grade}年${userData.class}組 ${userData.studentNumber != null ? `${userData.studentNumber}番` : ''}`
                : userData.role === 'staff' ? 'スタッフ' : ''}
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
              <p className="text-hatofes-gray-light text-sm mb-1">ユーザーID</p>
              <p className="text-hatofes-white font-mono">{getUserId()}</p>
            </div>
            <div>
              <p className="text-hatofes-gray-light text-sm mb-1">メールアドレス</p>
              <p className="text-hatofes-white">{userData.email}</p>
            </div>
            <div>
              <p className="text-hatofes-gray-light text-sm mb-1">ユーザーネーム</p>
              <p className="text-hatofes-white">{userData.username}</p>
            </div>

            {/* 本名 - staff/admin only */}
            {isStaffOrAdmin && (
              <div>
                <p className="text-hatofes-gray-light text-sm mb-1">
                  本名（通知・アンケート作成時に表示）
                </p>
                {editingRealName ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={realName}
                      onChange={(e) => setRealName(e.target.value)}
                      placeholder="本名を入力"
                      className="flex-1 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white text-sm"
                    />
                    <button
                      onClick={handleSaveRealName}
                      disabled={savingRealName || !realName.trim()}
                      className="px-4 py-2 bg-hatofes-accent-yellow text-hatofes-dark rounded-lg text-sm font-bold disabled:opacity-50"
                    >
                      {savingRealName ? '...' : '保存'}
                    </button>
                    <button
                      onClick={() => setEditingRealName(false)}
                      className="px-3 py-2 text-hatofes-gray text-sm"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-hatofes-white">
                      {userData.realName || '（未設定）'}
                    </p>
                    <button
                      onClick={() => {
                        setRealName(userData.realName || '')
                        setEditingRealName(true)
                      }}
                      className="text-xs text-hatofes-accent-yellow"
                    >
                      編集
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-hatofes-gray-light text-sm mb-1">所属</p>
              <p className="text-hatofes-white">
                {userData.role === 'teacher'
                  ? '教員'
                  : (userData.grade && userData.class)
                    ? `${userData.grade}年${userData.class}組`
                    : userData.role === 'staff' ? 'スタッフ' : ''}
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
          <Link to="/settings" className="btn-sub w-full py-3 rounded-full block text-center">
            設定
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
          >
            ログアウト
          </button>
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
