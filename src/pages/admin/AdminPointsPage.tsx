import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'

interface User {
  id: string
  email: string
  username: string
  grade?: number
  class?: string
  role: string
  totalPoints: number
}

const functions = getFunctions(app)
const grantPointsFn = httpsCallable(functions, 'grantPoints')

export default function AdminPointsPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [points, setPoints] = useState(10)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('username'))
        const snap = await getDocs(q)
        const list: User[] = []
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() } as User)
        })
        setUsers(list)
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const handleGrantPoints = async () => {
    if (!selectedUser || points <= 0) return

    setSubmitting(true)
    setMessage(null)

    try {
      await grantPointsFn({
        userId: selectedUser.id,
        points,
        reason: 'admin_grant',
        details: reason || '管理者による付与',
      })

      setMessage({ type: 'success', text: `${selectedUser.username} に ${points}pt を付与しました` })
      setSelectedUser(null)
      setPoints(10)
      setReason('')

      // Refresh user list
      const q = query(collection(db, 'users'), orderBy('username'))
      const snap = await getDocs(q)
      const list: User[] = []
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as User)
      })
      setUsers(list)
    } catch (error) {
      console.error('Error granting points:', error)
      setMessage({ type: 'error', text: 'ポイント付与に失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.grade && u.class && `${u.grade}-${u.class}`.includes(searchTerm))
  )

  return (
    <div className="min-h-screen bg-hatofes-bg">
      {/* Header */}
      <header className="bg-hatofes-dark border-b border-hatofes-gray-lighter px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-hatofes-gray hover:text-hatofes-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="font-display text-xl font-bold text-hatofes-white">ポイント付与</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Grant Form */}
        <div className="card mb-8">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">ポイントを付与</h2>

          {selectedUser ? (
            <div className="space-y-4">
              <div className="bg-hatofes-dark p-4 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-hatofes-white font-medium">{selectedUser.username}</p>
                  <p className="text-sm text-hatofes-gray">
                    {selectedUser.grade && selectedUser.class ? `${selectedUser.grade}-${selectedUser.class}` : selectedUser.role}
                    {' / '}{selectedUser.totalPoints.toLocaleString()} pt
                  </p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-hatofes-gray hover:text-hatofes-white">
                  変更
                </button>
              </div>

              <div>
                <label className="block text-sm text-hatofes-gray mb-2">付与ポイント</label>
                <input
                  type="number"
                  value={points}
                  onChange={e => setPoints(parseInt(e.target.value) || 0)}
                  min={1}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                />
              </div>

              <div>
                <label className="block text-sm text-hatofes-gray mb-2">理由（任意）</label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="例: イベント参加ボーナス"
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                />
              </div>

              <button
                onClick={handleGrantPoints}
                disabled={submitting || points <= 0}
                className="btn-main w-full py-3 rounded-lg disabled:opacity-50"
              >
                {submitting ? '処理中...' : `${points}pt を付与する`}
              </button>
            </div>
          ) : (
            <p className="text-hatofes-gray">下のユーザー一覧からユーザーを選択してください</p>
          )}
        </div>

        {/* User List */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-hatofes-white">ユーザー一覧</h2>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="検索..."
              className="bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-1 text-sm text-hatofes-white w-40"
            />
          </div>

          {loading ? (
            <p className="text-hatofes-gray text-center py-4">読み込み中...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">ユーザーが見つかりません</p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedUser?.id === user.id
                      ? 'bg-hatofes-accent-yellow/20 border border-hatofes-accent-yellow'
                      : 'bg-hatofes-dark hover:bg-hatofes-gray-lighter'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-hatofes-white font-medium">{user.username}</p>
                      <p className="text-xs text-hatofes-gray">
                        {user.grade && user.class ? `${user.grade}-${user.class}` : user.role}
                        {' / '}{user.email}
                      </p>
                    </div>
                    <span className="text-gradient font-bold">{user.totalPoints.toLocaleString()} pt</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
