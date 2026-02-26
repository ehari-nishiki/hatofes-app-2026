import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { SkeletonCard } from '@/components/ui/SkeletonLoader'
import type { Notification as NotificationType } from '@/types/firestore'

const functions = getFunctions(app)
const claimNotificationPointsFn = httpsCallable<
  { notificationId: string },
  { success: boolean; message: string }
>(functions, 'claimNotificationPoints')

type NotificationWithStatus = NotificationType & { id: string; isRead: boolean }

export default function NotificationsPage() {
  const { currentUser, userData } = useAuth()
  const [notifications, setNotifications] = useState<NotificationWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch notifications with server-side filtering (optimized with subcollection)
  useEffect(() => {
    if (!currentUser || !userData) return

    const fetchNotifications = async () => {
      setLoading(true)
      setError(null)
      try {
        console.log('[NotificationsPage] Fetching notifications for role:', userData.role)
        const q = query(
          collection(db, 'notifications'),
          where('targetRoles', 'array-contains', userData.role),
          orderBy('createdAt', 'desc'),
          limit(50)
        )

        const snapshot = await getDocs(q)
        console.log('[NotificationsPage] Fetched', snapshot.size, 'notifications')

        // Check read status for each notification from subcollection
        const list: NotificationWithStatus[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as NotificationType
            const readStatusDoc = await getDoc(
              doc(db, 'notifications', docSnap.id, 'readStatus', currentUser.uid)
            )
            const isRead = readStatusDoc.exists()

            console.log('[NotificationsPage] Notification:', docSnap.id, 'isRead:', isRead)
            return {
              id: docSnap.id,
              ...data,
              isRead,
            }
          })
        )

        // Sort: unread first, then by date
        list.sort((a, b) => {
          if (a.isRead !== b.isRead) return a.isRead ? 1 : -1
          return b.createdAt.seconds - a.createdAt.seconds
        })

        setNotifications(list)
        console.log('[NotificationsPage] Set notifications:', list.length)
      } catch (error) {
        console.error('Error fetching notifications:', error)
        const errorMessage = error instanceof Error ? error.message : '通知の取得に失敗しました'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
  }, [currentUser, userData])

  // Mark notification as read (using subcollection for cost optimization)
  const markAsRead = async (notifId: string) => {
    if (!currentUser) return
    try {
      // Set read status in subcollection
      await setDoc(
        doc(db, 'notifications', notifId, 'readStatus', currentUser.uid),
        {
          readAt: serverTimestamp(),
          pointsClaimed: false
        }
      )
      // Update local state
      setNotifications(prev => prev.map(n =>
        n.id === notifId ? { ...n, isRead: true } : n
      ))
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

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
            <p className="text-sm font-medium">エラー: {error}</p>
            <p className="text-xs mt-1">コンソールを確認してください</p>
          </div>
        )}

        {/* Notification List */}
        <div className="card">
          {loading ? (
            <SkeletonCard count={5} />
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
  const [senderInfo, setSenderInfo] = useState<{ name: string; role: string; department?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimingPoints, setClaimingPoints] = useState(false)
  const [pointsClaimed, setPointsClaimed] = useState(false)
  const [pointsMessage, setPointsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

          // Fetch sender information
          if (data.createdBy) {
            try {
              const senderDoc = await getDoc(doc(db, 'users', data.createdBy))
              if (senderDoc.exists()) {
                const senderData = senderDoc.data()
                setSenderInfo({
                  name: data.senderName || senderData.realName || senderData.username || '運営',
                  role: senderData.role || 'admin',
                  department: senderData.department || undefined
                })
              } else {
                setSenderInfo({
                  name: data.senderName || '運営',
                  role: 'admin'
                })
              }
            } catch (err) {
              console.error('Error fetching sender info:', err)
              setSenderInfo({
                name: data.senderName || '運営',
                role: 'admin'
              })
            }
          } else {
            setSenderInfo({
              name: data.senderName || '運営',
              role: 'admin'
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

  // ポイント付与のある通知を開いた時に自動的にポイントを請求
  useEffect(() => {
    const autoClaimPoints = async () => {
      if (!notification || !currentUser || pointsClaimed || claimingPoints) return
      if (!notification.points || notification.points <= 0) return

      // 既にポイントを受け取っているかチェック
      const pointsReceivedBy = (notification as any).pointsReceivedBy || []
      if (pointsReceivedBy.includes(currentUser.uid)) {
        setPointsClaimed(true)
        return
      }

      // 自動的にポイントを請求
      await handleClaimPoints()
    }

    autoClaimPoints()
  }, [notification, currentUser])

  const handleClaimPoints = async () => {
    if (!notificationId || !currentUser || claimingPoints) return

    setClaimingPoints(true)
    try {
      await claimNotificationPointsFn({ notificationId })
      setPointsClaimed(true)
      setPointsMessage({ type: 'success', text: `${notification?.points || 0}ptを獲得しました！` })
    } catch (error) {
      console.error('Error claiming points:', error)
      const msg = error instanceof Error ? error.message : 'ポイントの獲得に失敗しました'
      setPointsMessage({ type: 'error', text: msg })
    } finally {
      setClaimingPoints(false)
    }
  }

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
          {/* Twitter風 ユーザー情報表示 */}
          {senderInfo && (
            <div className="flex items-start gap-3 mb-4 pb-4 border-b border-hatofes-gray">
              {/* アイコン */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-hatofes-accent-yellow to-hatofes-accent-orange flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">
                  {senderInfo.name.charAt(0)}
                </span>
              </div>

              {/* 名前とロールバッジ */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-hatofes-white">{senderInfo.name}</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeStyle(senderInfo.role)}`}>
                    {getRoleLabel(senderInfo.role)}
                  </span>
                  {senderInfo.department && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-hatofes-gray/30 text-hatofes-gray-light">
                      {senderInfo.department}
                    </span>
                  )}
                </div>
                <p className="text-xs text-hatofes-gray mt-0.5">
                  {formatDate(notification.createdAt)}
                </p>
              </div>
            </div>
          )}

          <h1 className="text-lg font-bold text-hatofes-white mb-4">{notification.title}</h1>

          <div className="pt-2">
            <p className="text-hatofes-white whitespace-pre-wrap leading-relaxed">{notification.message}</p>
            {notification.imageUrl && (
              <img src={notification.imageUrl} alt="通知画像" className="mt-4 w-full rounded-lg" />
            )}
          </div>

          {/* ポイント獲得メッセージ */}
          {notification.points && notification.points > 0 && (
            <div className="mt-4 pt-4 border-t border-hatofes-gray">
              {pointsMessage && (
                <div className={`p-4 rounded-lg mb-3 ${
                  pointsMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  <p className="text-sm font-medium">{pointsMessage.text}</p>
                </div>
              )}
              {!pointsClaimed && !pointsMessage && claimingPoints && (
                <div className="flex items-center gap-2 text-hatofes-gray">
                  <div className="animate-spin w-4 h-4 border-2 border-hatofes-gray border-t-transparent rounded-full" />
                  <p className="text-sm">ポイントを付与中...</p>
                </div>
              )}
              {!pointsClaimed && !claimingPoints && !pointsMessage && (
                <div className="flex items-center justify-between p-3 bg-hatofes-accent-yellow/10 border border-hatofes-accent-yellow/30 rounded-lg">
                  <p className="text-sm text-hatofes-white">
                    🎁 この通知には <span className="font-bold text-hatofes-accent-yellow">{notification.points}pt</span> の報酬があります
                  </p>
                </div>
              )}
            </div>
          )}
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

function getRoleBadgeStyle(role: string): string {
  const styles: Record<string, string> = {
    admin: 'bg-red-500/20 text-red-400 border border-red-500/30',
    staff: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    teacher: 'bg-green-500/20 text-green-400 border border-green-500/30',
    student: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  }
  return styles[role] || styles.student
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: '管理者',
    staff: 'スタッフ',
    teacher: '教員',
    student: '生徒',
  }
  return labels[role] || '生徒'
}
