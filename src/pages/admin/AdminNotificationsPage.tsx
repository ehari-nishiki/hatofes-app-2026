import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { ImageUploader } from '@/components/ui/ImageUploader'

interface Notification {
  id: string
  title: string
  message: string
  targetRoles: string[]
  createdAt: Timestamp
}

export default function AdminNotificationsPage() {
  const { currentUser } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    imageUrl: '',
    targetRoles: ['student', 'teacher', 'staff', 'admin'] as string[],
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      const list: Notification[] = []
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Notification)
      })
      setNotifications(list)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newNotification.title || !newNotification.message) return

    setSubmitting(true)
    try {
      const notifId = `notif-${Date.now()}`
      await setDoc(doc(db, 'notifications', notifId), {
        title: newNotification.title,
        message: newNotification.message,
        ...(newNotification.imageUrl ? { imageUrl: newNotification.imageUrl } : {}),
        targetRoles: newNotification.targetRoles,
        targetUsers: [],
        createdBy: currentUser?.uid,
        createdAt: Timestamp.now(),
        readBy: [],
      })

      setMessage({ type: 'success', text: '通知を送信しました' })
      setShowCreate(false)
      setNewNotification({ title: '', message: '', imageUrl: '', targetRoles: ['student', 'teacher', 'staff', 'admin'] })
      fetchNotifications()
    } catch (error) {
      console.error('Error creating notification:', error)
      setMessage({ type: 'error', text: '通知送信に失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (notifId: string) => {
    if (!confirm('この通知を削除しますか？')) return

    try {
      await deleteDoc(doc(db, 'notifications', notifId))
      fetchNotifications()
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const toggleRole = (role: string) => {
    setNewNotification(prev => {
      const roles = prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role]
      return { ...prev, targetRoles: roles }
    })
  }

  const roleLabels: Record<string, string> = {
    student: '生徒',
    teacher: '教員',
    staff: 'スタッフ',
    admin: '管理者',
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
            <h1 className="font-display text-xl font-bold text-hatofes-white">通知送信</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-main text-sm px-4 py-2">
            新規作成
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Create Form Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-hatofes-card rounded-lg p-6 w-full max-w-lg">
              <h2 className="text-lg font-bold text-hatofes-white mb-4">通知を作成</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">タイトル</label>
                  <input
                    type="text"
                    value={newNotification.title}
                    onChange={e => setNewNotification(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    placeholder="例: 重要なお知らせ"
                  />
                </div>

                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">メッセージ</label>
                  <textarea
                    value={newNotification.message}
                    onChange={e => setNewNotification(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    rows={4}
                    placeholder="通知の内容を入力してください"
                  />
                </div>

                <ImageUploader
                  imageUrl={newNotification.imageUrl}
                  onChange={url => setNewNotification(prev => ({ ...prev, imageUrl: url }))}
                  label="添付画像"
                />

                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">送信対象</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(roleLabels).map(([role, label]) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          newNotification.targetRoles.includes(role)
                            ? 'bg-hatofes-accent-yellow text-black'
                            : 'bg-hatofes-dark text-hatofes-gray border border-hatofes-gray'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowCreate(false)} className="btn-sub flex-1 py-2">
                  キャンセル
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !newNotification.title || !newNotification.message}
                  className="btn-main flex-1 py-2 disabled:opacity-50"
                >
                  {submitting ? '送信中...' : '送信'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification List */}
        <div className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">送信済み通知</h2>

          {loading ? (
            <p className="text-hatofes-gray text-center py-4">読み込み中...</p>
          ) : notifications.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">通知がありません</p>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => (
                <div key={notif.id} className="bg-hatofes-dark p-4 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-hatofes-white font-medium">{notif.title}</h3>
                      <p className="text-sm text-hatofes-gray mt-1 whitespace-pre-wrap">{notif.message}</p>
                      {(notif as any).imageUrl && (
                        <img src={(notif as any).imageUrl} alt="通知画像" className="mt-2 max-h-24 rounded-lg object-contain" />
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-hatofes-gray">
                          対象: {notif.targetRoles.map(r => roleLabels[r]).join(', ')}
                        </span>
                        <span className="text-xs text-hatofes-gray">
                          {notif.createdAt?.toDate?.()?.toLocaleDateString('ja-JP') || ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(notif.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      削除
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
