import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { SkeletonCard } from '@/components/ui/SkeletonLoader'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { hapticLight } from '@/lib/haptics'
import type { Notification as NotificationType, NotificationReadStatus } from '@/types/firestore'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

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

  useEffect(() => {
    if (!currentUser || !userData) return

    const fetchNotifications = async () => {
      setLoading(true)
      setError(null)

      try {
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('targetRoles', 'array-contains', userData.role),
          orderBy('createdAt', 'desc'),
          limit(50)
        )

        const snapshot = await getDocs(notificationsQuery)

        const list: NotificationWithStatus[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as NotificationType
            const readStatusDoc = await getDoc(
              doc(db, 'notifications', docSnap.id, 'readStatus', currentUser.uid)
            )

            return {
              id: docSnap.id,
              ...data,
              isRead: readStatusDoc.exists(),
            }
          })
        )

        list.sort((a, b) => {
          if (a.isRead !== b.isRead) return a.isRead ? 1 : -1
          return b.createdAt.seconds - a.createdAt.seconds
        })

        setNotifications(list)
      } catch (fetchError) {
        console.error('Error fetching notifications:', fetchError)
        const message = fetchError instanceof Error ? fetchError.message : '通知の取得に失敗しました'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
  }, [currentUser, userData])

  const markAsRead = async (notifId: string) => {
    if (!currentUser) return

    try {
      await setDoc(doc(db, 'notifications', notifId, 'readStatus', currentUser.uid), {
        readAt: serverTimestamp(),
        pointsClaimed: false,
      })

      setNotifications((prev) => prev.map((item) => (
        item.id === notifId ? { ...item, isRead: true } : item
      )))
    } catch (markError) {
      console.error('Error marking notification as read:', markError)
    }
  }

  if (!userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <div className="text-white">読み込み中...</div>
      </div>
    )
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      <PageHero
        eyebrow="Inbox"
        title="Notifications"
        description="重要なお知らせ、報酬付き通知、運営からの連絡をここでまとめて確認します。"
        badge={unreadCount > 0 ? <UnreadBadge count={unreadCount} /> : undefined}
        aside={<PageBackLink />}
      />

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <PageSection>
            <PageSectionTitle eyebrow="Summary" title="受信状況" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <InboxMetric label="未読" value={unreadCount.toString()} />
            <InboxMetric label="総件数" value={notifications.length.toString()} />
          </div>
          {error ? (
            <div className="mt-4 rounded-[1rem] border border-[#7f3137] bg-[#2b171a] p-4">
              <p className="text-sm font-medium text-[#ffb8bf]">エラー: {error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-[0.9rem] bg-white/10 px-4 text-sm text-white/78 transition-colors hover:bg-white/14 hover:text-white"
              >
                再読み込み
              </button>
            </div>
          ) : null}
        </PageSection>

        <PageSection>
          <PageSectionTitle
            eyebrow="All Messages"
            title="通知一覧"
            meta={<span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/58">{unreadCount} unread</span>}
          />

          {loading ? (
            <SkeletonCard count={5} />
          ) : notifications.length === 0 ? (
            <PageEmptyState title="通知はありません" description="新しいお知らせが届くとここに表示されます。" />
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={`/notifications/${notification.id}`}
                  onClick={() => markAsRead(notification.id)}
                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.15rem] px-4 py-4 transition-colors ${
                    notification.isRead ? 'bg-[#0f1418] hover:bg-[#131920]' : 'bg-white/[0.06] hover:bg-white/[0.085]'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${notification.isRead ? 'bg-white/18' : 'bg-[#e24d4d]'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-sm ${notification.isRead ? 'text-white/72' : 'font-semibold text-white'}`}>
                        {notification.title}
                      </p>
                      {notification.points && notification.points > 0 ? (
                        <span className="rounded-full bg-[#d9e4dc] px-2 py-0.5 text-[11px] font-semibold text-[#11161a]">
                          {notification.points}pt
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-white/42">{formatDate(notification.createdAt)}</p>
                  </div>
                  <ChevronRightIcon />
                </Link>
              ))}
            </div>
          )}
        </PageSection>
      </div>
    </UserPageShell>
  )
}

export function NotificationDetailPage() {
  const { notificationId } = useParams<{ notificationId: string }>()
  const navigate = useNavigate()
  const { currentUser, userData } = useAuth()
  const [notification, setNotification] = useState<NotificationWithStatus | null>(null)
  const [senderInfo, setSenderInfo] = useState<{ name: string; role: string; department?: string; profileImageUrl?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimingPoints, setClaimingPoints] = useState(false)
  const [pointsClaimed, setPointsClaimed] = useState(false)
  const [pointsMessage, setPointsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [userReaction, setUserReaction] = useState<string | null>(null)

  useEffect(() => {
    if (!notificationId || !currentUser) return

    const fetchNotification = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'notifications', notificationId))
        if (docSnap.exists()) {
          const data = docSnap.data() as NotificationType
          const readStatusRef = doc(db, 'notifications', notificationId, 'readStatus', currentUser.uid)
          const readStatusSnap = await getDoc(readStatusRef)
          const isRead = readStatusSnap.exists()
          const readStatus = readStatusSnap.data() as NotificationReadStatus | undefined

          setNotification({
            id: docSnap.id,
            ...data,
            isRead,
          })

          if (!isRead) {
            await setDoc(readStatusRef, {
              readAt: serverTimestamp(),
              pointsClaimed: false,
            })
            setNotification((prev) => (prev ? { ...prev, isRead: true } : prev))
          } else if (readStatus?.pointsClaimed) {
            setPointsClaimed(true)
          }

          setSenderInfo({
            name: data.senderName || '運営',
            role: data.senderRole || 'admin',
            department: data.senderDepartment || undefined,
            profileImageUrl: data.senderProfileImageUrl || undefined,
          })
        }
      } catch (fetchError) {
        console.error('Error fetching notification:', fetchError)
      } finally {
        setLoading(false)
      }
    }

    fetchNotification()
  }, [notificationId, currentUser])

  useEffect(() => {
    if (!notificationId || !currentUser) return

    const fetchReaction = async () => {
      try {
        const reactionDoc = await getDoc(doc(db, 'notifications', notificationId, 'reactions', currentUser.uid))
        if (reactionDoc.exists()) {
          setUserReaction(reactionDoc.data().emoji)
        }
      } catch {
        // ignore
      }
    }

    fetchReaction()
  }, [notificationId, currentUser])

  const handleClaimPoints = useCallback(async () => {
    if (!notificationId || !currentUser || claimingPoints) return

    setClaimingPoints(true)
    try {
      await claimNotificationPointsFn({ notificationId })
      setPointsClaimed(true)
      setPointsMessage({ type: 'success', text: `${notification?.points || 0}ptを獲得しました` })
    } catch (claimError) {
      console.error('Error claiming points:', claimError)
      const message = claimError instanceof Error ? claimError.message : 'ポイントの獲得に失敗しました'
      setPointsMessage({ type: 'error', text: message })
    } finally {
      setClaimingPoints(false)
    }
  }, [notification?.points, notificationId, currentUser, claimingPoints])

  useEffect(() => {
    const autoClaimPoints = async () => {
      if (!notification || !currentUser || pointsClaimed || claimingPoints) return
      if (!notification.points || notification.points <= 0) return

      const pointsReceivedBy = notification.pointsReceivedBy || []
      if (pointsReceivedBy.includes(currentUser.uid)) {
        setPointsClaimed(true)
        return
      }

      await handleClaimPoints()
    }

    autoClaimPoints()
  }, [notification, currentUser, pointsClaimed, claimingPoints, handleClaimPoints])

  const handleReaction = async (emoji: string) => {
    if (!notificationId || !currentUser) return

    hapticLight()
    const reactionRef = doc(db, 'notifications', notificationId, 'reactions', currentUser.uid)
    try {
      if (userReaction === emoji) {
        await deleteDoc(reactionRef)
        setUserReaction(null)
      } else {
        await setDoc(reactionRef, {
          emoji,
          reactedAt: serverTimestamp(),
        })
        setUserReaction(emoji)
      }
    } catch (reactionError) {
      console.error('Error setting reaction:', reactionError)
    }
  }

  const statusBadge = useMemo(() => {
    if (!notification?.points || notification.points <= 0) return null
    return (
      <span className="rounded-full bg-[#d9e4dc] px-3 py-1 text-xs font-semibold text-[#11161a]">
        Reward {notification.points}pt
      </span>
    )
  }, [notification?.points])

  if (!userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <div className="text-white">読み込み中...</div>
      </div>
    )
  }

  if (loading) {
    return (
      <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
        <PageHero eyebrow="Inbox" title="Notification" description="通知内容を読み込み中です。" aside={<PageBackLink to="/notifications" label="一覧へ戻る" />} />
        <PageSection>
          <PageEmptyState title="読み込み中です" />
        </PageSection>
      </UserPageShell>
    )
  }

  if (!notification) {
    return (
      <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
        <PageHero eyebrow="Inbox" title="Notification" description="通知が見つかりませんでした。" aside={<PageBackLink to="/notifications" label="一覧へ戻る" />} />
        <PageSection>
          <PageEmptyState title="通知が見つかりません" />
        </PageSection>
      </UserPageShell>
    )
  }

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      <PageHero
        eyebrow="Notification Detail"
        title={notification.title}
        description={formatDate(notification.createdAt)}
        badge={statusBadge}
        aside={<PageBackLink to="/notifications" label="一覧へ戻る" />}
      />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <PageSection>
          {senderInfo ? (
            <div className="mb-5 flex items-start gap-3 rounded-[1.1rem] bg-[#0f1418] p-4">
              <UserAvatar name={senderInfo.name} imageUrl={senderInfo.profileImageUrl} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{senderInfo.name}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] ${getRoleBadgeStyle(senderInfo.role)}`}>
                    {getRoleLabel(senderInfo.role)}
                  </span>
                  {senderInfo.department ? (
                    <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] text-white/58">
                      {senderInfo.department}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-white/42">{formatDate(notification.createdAt)}</p>
              </div>
            </div>
          ) : null}

          <div className="rounded-[1.2rem] bg-[#0f1418] p-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-white/82">{notification.message}</p>
            {notification.imageUrl && isTrustedImageUrl(notification.imageUrl) ? (
              <img src={notification.imageUrl} alt="通知画像" className="mt-5 w-full rounded-[1rem]" loading="lazy" />
            ) : null}
          </div>
        </PageSection>

        <div className="space-y-4">
          <PageSection>
            <PageSectionTitle eyebrow="Reaction" title="リアクション" />
            <div className="flex flex-wrap gap-2">
              {['👍', '❤️', '😂', '🎉', '😮'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-lg transition-transform ${
                    userReaction === emoji
                      ? 'bg-white text-[#11161a] scale-105'
                      : 'bg-[#0f1418] text-white hover:scale-105'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PageSection>

          {notification.points && notification.points > 0 ? (
            <PageSection>
              <PageSectionTitle eyebrow="Reward" title="ポイント付与" />
              {pointsMessage ? (
                <div className={`rounded-[1rem] p-4 ${pointsMessage.type === 'success' ? 'bg-[#18251d] text-[#bde5c5]' : 'bg-[#2b171a] text-[#ffb8bf]'}`}>
                  <p className="text-sm font-medium">{pointsMessage.text}</p>
                </div>
              ) : null}

              {!pointsClaimed && !pointsMessage && claimingPoints ? (
                <p className="text-sm text-white/56">ポイントを付与しています...</p>
              ) : null}

              {!pointsClaimed && !claimingPoints && !pointsMessage ? (
                <div className="rounded-[1rem] bg-[#0f1418] p-4">
                  <p className="text-sm leading-6 text-white/72">
                    この通知には <span className="font-semibold text-white">{notification.points}pt</span> の報酬があります。
                  </p>
                </div>
              ) : null}
            </PageSection>
          ) : null}

          <PageSection>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.04] px-4 text-sm font-medium text-white/78 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              戻る
            </button>
          </PageSection>
        </div>
      </div>
    </UserPageShell>
  )
}

function InboxMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] bg-[#0f1418] p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/36">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">{value}</p>
    </div>
  )
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-[#e24d4d] px-3 py-1 text-xs font-semibold text-white">
      {count} unread
    </span>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="h-5 w-5 flex-shrink-0 text-white/32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
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
    admin: 'bg-[#391d20] text-[#ffb8bf]',
    staff: 'bg-[#3c2a1a] text-[#ffca94]',
    teacher: 'bg-[#1b3122] text-[#bde5c5]',
    student: 'bg-[#1a2432] text-[#bfd5ff]',
  }
  return styles[role] || styles.student
}

function isTrustedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const trustedHosts = [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'lh3.googleusercontent.com',
    ]
    return trustedHosts.some((host) => parsed.hostname.endsWith(host)) ||
      parsed.hostname.endsWith('.r2.cloudflarestorage.com') ||
      parsed.hostname.endsWith('.r2.dev')
  } catch {
    return false
  }
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
