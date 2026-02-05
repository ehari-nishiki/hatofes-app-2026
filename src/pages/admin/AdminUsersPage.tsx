import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'

const functions = getFunctions(app)
const updateUserRoleFn = httpsCallable<
  { userId: string; role: string },
  { success: boolean; message: string }
>(functions, 'updateUserRole')

interface User {
  id: string
  email: string
  username: string
  grade?: number
  class?: string
  role: string
  totalPoints: number
}

const roleLabels: Record<string, string> = {
  student: '生徒',
  teacher: '教員',
  staff: 'スタッフ',
  admin: '管理者',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newRole, setNewRole] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('username'))
      const snap = await getDocs(q)
      const list: User[] = []
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as User)
      })
      setUsers(list)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRole = async () => {
    if (!editingUser || !newRole) return

    try {
      await updateUserRoleFn({ userId: editingUser.id, role: newRole })
      setMessage({ type: 'success', text: `${editingUser.username} のロールを ${roleLabels[newRole]} に変更しました` })
      setEditingUser(null)
      setNewRole('')
      fetchUsers()
    } catch (error) {
      console.error('Error updating role:', error)
      const msg = error instanceof Error ? error.message : 'ロールの変更に失敗しました'
      setMessage({ type: 'error', text: msg })
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.grade && u.class && `${u.grade}-${u.class}`.includes(searchTerm))
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const userStats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    staff: users.filter(u => u.role === 'staff').length,
    admins: users.filter(u => u.role === 'admin').length,
  }

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
            <h1 className="font-display text-xl font-bold text-hatofes-white">ユーザー管理</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-hatofes-white">{userStats.total}</p>
            <p className="text-xs text-hatofes-gray">合計</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-blue-400">{userStats.students}</p>
            <p className="text-xs text-hatofes-gray">生徒</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-green-400">{userStats.teachers}</p>
            <p className="text-xs text-hatofes-gray">教員</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-purple-400">{userStats.staff}</p>
            <p className="text-xs text-hatofes-gray">スタッフ</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-hatofes-accent-yellow">{userStats.admins}</p>
            <p className="text-xs text-hatofes-gray">管理者</p>
          </div>
        </div>

        {/* Role Edit Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-hatofes-dark rounded-lg p-6 w-full max-w-md border border-hatofes-gray">
              <h2 className="text-lg font-bold text-hatofes-white mb-4">ロールを変更</h2>

              <div className="bg-hatofes-dark p-4 rounded-lg mb-4">
                <p className="text-hatofes-white font-medium">{editingUser.username}</p>
                <p className="text-sm text-hatofes-gray">{editingUser.email}</p>
                <p className="text-sm text-hatofes-gray">
                  現在のロール: <span className="text-hatofes-white">{roleLabels[editingUser.role]}</span>
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-hatofes-gray mb-2">新しいロール</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                >
                  <option value="">選択してください</option>
                  <option value="student">生徒</option>
                  <option value="teacher">教員</option>
                  <option value="staff">スタッフ</option>
                  <option value="admin">管理者</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setEditingUser(null); setNewRole('') }} className="btn-sub flex-1 py-2">
                  キャンセル
                </button>
                <button onClick={handleUpdateRole} disabled={!newRole} className="btn-main flex-1 py-2 disabled:opacity-50">
                  変更
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="名前・メール・クラスで検索..."
              className="flex-1 bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
            />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
            >
              <option value="all">全てのロール</option>
              <option value="student">生徒</option>
              <option value="teacher">教員</option>
              <option value="staff">スタッフ</option>
              <option value="admin">管理者</option>
            </select>
          </div>
        </div>

        {/* User List */}
        <div className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">
            ユーザー一覧 ({filteredUsers.length}人)
          </h2>

          {loading ? (
            <p className="text-hatofes-gray text-center py-4">読み込み中...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">ユーザーが見つかりません</p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto space-y-2">
              {filteredUsers.map(user => (
                <div key={user.id} className="bg-hatofes-dark p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-hatofes-white font-medium truncate">{user.username}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          user.role === 'admin' ? 'bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow' :
                          user.role === 'staff' ? 'bg-purple-500/20 text-purple-400' :
                          user.role === 'teacher' ? 'bg-green-500/20 text-green-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {roleLabels[user.role]}
                        </span>
                      </div>
                      <p className="text-xs text-hatofes-gray truncate">{user.email}</p>
                      <div className="flex items-center gap-2 text-xs text-hatofes-gray mt-1">
                        {user.grade && user.class && (
                          <span>{user.grade}-{user.class}</span>
                        )}
                        <span className="text-gradient">{user.totalPoints.toLocaleString()}pt</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditingUser(user); setNewRole(user.role) }}
                      className="text-sm text-hatofes-gray hover:text-hatofes-white px-2"
                    >
                      編集
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
