import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { collection, query, orderBy, doc, updateDoc, arrayUnion, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import type { Notification as NotificationType } from '@/types/firestore'

type NotificationWithStatus = NotificationType & { id: string; isRead: boolean }

export default function NotificationsPage() {
  const { currentUser, userData } = useAuth()
  const [notifications, setNotifications] = useState<NotificationWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  // Use real-time listener for notifications
  useEffect(() => {
    if (!currentUser || !userData) return

    setLoading(true)
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snap) => {
      const list: NotificationWithStatus[] = []

      snap.forEach((docSnap) => {
        const data = docSnap.data() as NotificationType
        // Check if user's role is in target roles (empty means all)
        if (data.targetRoles.length === 0 || data.targetRoles.includes(userData.role)) {
          list.push({
            id: docSnap.id,
            ...data,
            isRead: data.readBy?.includes(currentUser.uid) || false,
          })
        }
      })

      list.sort((a, b) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        return b.createdAt.seconds - a.createdAt.seconds;
      });

      setNotifications(list)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching notifications:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [currentUser, userData])

  // Mark notification as read (onSnapshot will auto-update the list)
  const markAsRead = async (notifId: string) => {
    if (!currentUser) return
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        readBy: arrayUnion(currentUser.uid)
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="min-h-screen bg-hatofes-bg pb-8">
      <AppHeader
        username={userData.username}
        grade={userData.grade}
        classNumber={userData.class}
      />

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-hatofes-white">通知一覧</h1>
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount}</span>
          )}
        </div>

        {/* Notification List */}
        <div className="card">
          {loading ? (
            <p className="text-hatofes-gray text-center py-4">読み込み中...</p>
          ) : notifications.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">通知はありません</p>
          ) : (
            <ul className="divide-y divide-hatofes-gray">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    to={`/notifications/${notification.id}`}
                    onClick={() => markAsRead(notification.id)}
                    className="flex items-center justify-between py-4 hover:bg-hatofes-dark transition-colors -mx-4 px-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-hatofes-accent-orange rounded-full flex-shrink-0" />
                        )}
                        <p className={`text-sm truncate ${notification.isRead ? 'text-hatofes-gray' : 'text-hatofes-white font-bold'}`}>
                          {notification.title}
                        </p>
                      </div>
                      <p className="text-hatofes-gray text-xs mt-1">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    <ChevronRightIcon />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Back Button */}
        <Link to="/home" className="block mt-6">
          <div className="btn-sub w-full py-3 text-center">
            ホームに戻る
          </div>
        </Link>
      </main>
    </div>
  )
}

// Notification Detail Page Component
export function NotificationDetailPage() {
  const { notificationId } = useParams<{ notificationId: string }>()
  const navigate = useNavigate()
  const { currentUser, userData } = useAuth()
  const [notification, setNotification] = useState<NotificationWithStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!notificationId || !currentUser) return

    const fetchNotification = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'notifications', notificationId))
        if (docSnap.exists()) {
          const data = docSnap.data() as NotificationType
          setNotification({
            id: docSnap.id,
            ...data,
            isRead: data.readBy?.includes(currentUser.uid) || false,
          })

          // Mark as read
          if (!data.readBy?.includes(currentUser.uid)) {
            await updateDoc(doc(db, 'notifications', notificationId), {
              readBy: arrayUnion(currentUser.uid)
            })
          }
        }
      } catch (error) {
        console.error('Error fetching notification:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNotification()
  }, [notificationId, currentUser])

  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hatofes-bg">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-hatofes-white">読み込み中...</div>
        </div>
      </div>
    )
  }

  if (!notification) {
    return (
      <div className="min-h-screen bg-hatofes-bg">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />
        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="card">
            <p className="text-hatofes-gray text-center py-4">通知が見つかりません</p>
          </div>
          <Link to="/notifications" className="block mt-6">
            <div className="btn-sub w-full py-3 text-center">
              通知一覧に戻る
            </div>
          </Link>
        </main>
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

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="card">
          <h1 className="text-lg font-bold text-hatofes-white mb-2">{notification.title}</h1>
          <p className="text-xs text-hatofes-gray mb-4">
            {formatDate(notification.createdAt)}
          </p>
          <div className="border-t border-hatofes-gray pt-4">
            <p className="text-hatofes-white whitespace-pre-wrap">{notification.message}</p>
            {notification.imageUrl && (
              <img src={notification.imageUrl} alt="通知画像" className="mt-4 w-full rounded-lg" />
            )}
          </div>
        </div>

        <button onClick={() => navigate(-1)} className="block mt-6 w-full">
          <div className="btn-sub w-full py-3 text-center">
            戻る
          </div>
        </button>
      </main>
    </div>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-5 h-5 text-hatofes-gray flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function formatDate(timestamp: { seconds: number; nanoseconds: number } | undefined): string {
  if (!timestamp) return ''
  const date = new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
