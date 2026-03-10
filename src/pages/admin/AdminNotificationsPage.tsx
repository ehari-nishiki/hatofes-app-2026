import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Toast, useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Notification as NotificationDoc, UserRole } from '@/types/firestore'

interface NotificationListItem extends Pick<NotificationDoc, 'title' | 'message' | 'targetRoles' | 'createdAt' | 'imageUrl' | 'isImportant'> {
  id: string
}

export default function AdminNotificationsPage() {
  const { currentUser, userData } = useAuth()
  const [notifications, setNotifications] = useState<NotificationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    imageUrl: '',
    points: 0,
    isImportant: false,
    targetRoles: ['student', 'teacher', 'staff', 'admin'] as UserRole[],
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [fixing, setFixing] = useState(false)
  const { toast, hideToast } = useToast()
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      const list: NotificationListItem[] = []
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...(docSnap.data() as NotificationDoc) })
      })
      setNotifications(list)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newNotification.title || !newNotification.message) {
      setMessage({ type: 'error', text: 'タイトルとメッセージを入力してください' })
      return
    }

    if (newNotification.targetRoles.length === 0) {
      setMessage({ type: 'error', text: '送信対象を少なくとも1つ選択してください' })
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const notifId = `notif-${Date.now()}`
      const senderName = userData?.realName || userData?.username || '運営'
      await setDoc(doc(db, 'notifications', notifId), {
        title: newNotification.title,
        message: newNotification.message,
        ...(newNotification.imageUrl ? { imageUrl: newNotification.imageUrl } : {}),
        ...(newNotification.points > 0 ? { points: newNotification.points, pointsReceivedBy: [] } : {}),
        ...(newNotification.isImportant ? { isImportant: true } : {}),
        targetRoles: newNotification.targetRoles,
        targetUsers: [],
        createdBy: currentUser?.uid,
        senderName,
        ...(userData?.role ? { senderRole: userData.role } : {}),
        ...(userData?.department ? { senderDepartment: userData.department } : {}),
        ...(userData?.profileImageUrl ? { senderProfileImageUrl: userData.profileImageUrl } : {}),
        createdAt: Timestamp.now(),
        readCount: 0, // Initialize readCount for new notification system
        readBy: [], // Keep for backwards compatibility during transition
      })

      setMessage({ type: 'success', text: '通知を送信しました' })
      // Add to local state instead of refetching
      const createdNotif: NotificationListItem = {
        id: notifId,
        title: newNotification.title,
        message: newNotification.message,
        targetRoles: newNotification.targetRoles,
        createdAt: Timestamp.now(),
        imageUrl: newNotification.imageUrl || undefined,
        isImportant: newNotification.isImportant,
      }
      setNotifications(prev => [createdNotif, ...prev])
      setShowCreate(false)
      setNewNotification({ title: '', message: '', imageUrl: '', points: 0, isImportant: false, targetRoles: ['student', 'teacher', 'staff', 'admin'] })
    } catch (error) {
      console.error('Error creating notification:', error)
      setMessage({ type: 'error', text: '通知送信に失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (notifId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '通知の削除',
      message: 'この通知を削除しますか？',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          await deleteDoc(doc(db, 'notifications', notifId))
          // Remove from local state instead of refetching
          setNotifications(prev => prev.filter(n => n.id !== notifId))
        } catch (error) {
          console.error('Error deleting notification:', error)
        }
      },
    })
  }

  const handleFixOldNotifications = () => {
    setConfirmDialog({
      isOpen: true,
      title: '古い通知の修正',
      message: '古い通知にtargetRolesフィールドを追加しますか？（全ロール対象になります）',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        await doFixOldNotifications()
      },
    })
  }

  const doFixOldNotifications = async () => {
    setFixing(true)
    setMessage(null)
    try {
      const snap = await getDocs(collection(db, 'notifications'))
      let fixedCount = 0

      for (const docSnap of snap.docs) {
        const data = docSnap.data()
        // targetRolesが存在しないか空の場合のみ修正
        if (!data.targetRoles || data.targetRoles.length === 0) {
          await setDoc(doc(db, 'notifications', docSnap.id), {
            ...data,
            targetRoles: ['student', 'teacher', 'staff', 'admin']
          })
          fixedCount++
        }
      }

      setMessage({ type: 'success', text: `${fixedCount}件の通知を修正しました` })
      await fetchNotifications()
    } catch (error) {
      console.error('Error fixing notifications:', error)
      setMessage({ type: 'error', text: '修正に失敗しました' })
    } finally {
      setFixing(false)
    }
  }

  const toggleRole = (role: UserRole) => {
    setNewNotification(prev => {
      const roles = prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role]
      return { ...prev, targetRoles: roles }
    })
  }

  const roleLabels: Record<UserRole, string> = {
    student: '生徒',
    teacher: '教員',
    staff: 'スタッフ',
    admin: '管理者',
  }

  return (
    <div className="min-h-screen bg-hatofes-bg">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant="danger"
        confirmLabel="実行"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
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
          <div className="flex gap-2">
            <button
              onClick={handleFixOldNotifications}
              disabled={fixing}
              className="btn-sub text-xs px-3 py-2 disabled:opacity-50"
            >
              {fixing ? '修正中...' : '🔧 古い通知を修正'}
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-main text-sm px-4 py-2">
              新規作成
            </button>
          </div>
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
                  <label className="block text-sm text-hatofes-gray mb-1">
                    付与ポイント（任意）
                  </label>
                  <input
                    type="number"
                    value={newNotification.points}
                    onChange={e => setNewNotification(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                    min={0}
                    className="w-32 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    placeholder="0"
                  />
                  <p className="text-xs text-hatofes-gray mt-1">
                    通知を開いた時に付与されるポイント（0 = 付与なし）
                  </p>
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-hatofes-gray bg-hatofes-dark px-3 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNotification.isImportant}
                    onChange={e => setNewNotification(prev => ({ ...prev, isImportant: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="text-sm text-hatofes-white">重要なお知らせとして表示</p>
                    <p className="text-xs text-hatofes-gray">ホームの重要なお知らせで優先表示されます</p>
                  </div>
                </label>

                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">送信対象</label>
                  <div className="flex flex-wrap gap-2">
                      {Object.entries(roleLabels).map(([role, label]) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRole(role as UserRole)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          newNotification.targetRoles.includes(role as UserRole)
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-hatofes-white font-medium">{notif.title}</h3>
                        {notif.isImportant ? <span className="notification-badge">重要</span> : null}
                      </div>
                      <p className="text-sm text-hatofes-gray mt-1 whitespace-pre-wrap">{notif.message}</p>
                      {notif.imageUrl && (
                        <img src={notif.imageUrl} alt="通知画像" className="mt-2 max-h-24 rounded-lg object-contain" />
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
