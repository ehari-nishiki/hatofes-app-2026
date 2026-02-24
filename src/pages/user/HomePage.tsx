import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, limit, doc, setDoc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore'
import { animate, stagger } from 'animejs'
import { db } from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import { PageLoader, AnimatedNumber } from '@/components/ui/PageLoader'
import { Spinner } from '@/components/ui/Spinner'
import CountdownTimer from '@/components/ui/CountdownTimer'
import { calculateLevel, getPointsToNextLevel, LEVEL_TITLES, LEVEL_COLORS } from '@/lib/levelSystem'
import { CacheService } from '@/lib/cacheService'
import type { Survey, Notification as NotificationType } from '@/types/firestore'

interface FeatureToggles {
  boothsEnabled: boolean
  eventsEnabled: boolean
  radioEnabled: boolean
  executiveQAEnabled: boolean
}

type SurveyWithStatus = Survey & { id: string; isAnswered: boolean }
type NotificationWithStatus = NotificationType & { id: string; isRead: boolean }

export default function HomePage() {
  const { currentUser, userData, refreshUserData } = useAuth()
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [rewardPoints, setRewardPoints] = useState(0)
  const [rewardReason, setRewardReason] = useState('')

  // Real data from Firestore
  const [notifications, setNotifications] = useState<NotificationWithStatus[]>([])
  const [tasks, setTasks] = useState<SurveyWithStatus[]>([])
  const [missions, setMissions] = useState<SurveyWithStatus[]>([])
  const [loginBonusAvailable, setLoginBonusAvailable] = useState(false)
  const [claimingBonus, setClaimingBonus] = useState(false)
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>({
    boothsEnabled: false,
    eventsEnabled: false,
    radioEnabled: false,
    executiveQAEnabled: false,
  })
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(true)
  const [missionsLoading, setMissionsLoading] = useState(true)
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)

  // Subscribe to feature toggles
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'featureToggles'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as FeatureToggles
        setFeatureToggles({
          boothsEnabled: data.boothsEnabled ?? false,
          eventsEnabled: data.eventsEnabled ?? false,
          radioEnabled: data.radioEnabled ?? false,
          executiveQAEnabled: data.executiveQAEnabled ?? false,
        })
      }
    })
    return () => unsubscribe()
  }, [])

  // Fetch notifications with server-side filtering (optimized with subcollection)
  useEffect(() => {
    if (!currentUser || !userData) return

    const fetchNotifications = async () => {
      try {
        console.log('[HomePage] Fetching notifications for role:', userData.role)
        // Fetch notifications (limit to 10 for DB efficiency, covers most use cases)
        const notifQuery = query(
          collection(db, 'notifications'),
          where('targetRoles', 'array-contains', userData.role),
          orderBy('createdAt', 'desc'),
          limit(10)
        )
        const notifSnap = await getDocs(notifQuery)
        console.log('[HomePage] Fetched', notifSnap.size, 'notifications')

        // Check read status for each notification from subcollection
        const notifList: NotificationWithStatus[] = await Promise.all(
          notifSnap.docs.map(async (docSnap) => {
            const data = docSnap.data() as NotificationType
            const readStatusDoc = await getDoc(
              doc(db, 'notifications', docSnap.id, 'readStatus', currentUser.uid)
            )
            const isRead = readStatusDoc.exists()

            return {
              id: docSnap.id,
              ...data,
              isRead,
            }
          })
        )

        // Count total unread
        const unreadCount = notifList.filter(n => !n.isRead).length
        setTotalUnreadCount(unreadCount)

        // Sort: unread first, then by createdAt desc
        const sortedList = [...notifList].sort((a, b) => {
          // Unread comes first
          if (a.isRead !== b.isRead) {
            return a.isRead ? 1 : -1
          }
          // Then sort by date (newest first)
          const dateA = a.createdAt?.toDate?.() || new Date(0)
          const dateB = b.createdAt?.toDate?.() || new Date(0)
          return dateB.getTime() - dateA.getTime()
        })

        setNotifications(sortedList)
      } catch (error) {
        console.error('[HomePage] Error fetching notifications:', error)
        if (error instanceof Error) {
          console.error('[HomePage] Error details:', error.message)
        }
      } finally {
        setNotificationsLoading(false)
      }
    }

    fetchNotifications()
  }, [currentUser, userData])

  // Fetch tasks and missions (shared surveyResponses fetch) with caching
  useEffect(() => {
    if (!currentUser || !userData) return

    const fetchTasksAndMissions = async () => {
      try {
        // Check cache first (5 minute expiration)
        const cachedTasks = CacheService.get<SurveyWithStatus[]>('tasks')
        const cachedMissions = CacheService.get<SurveyWithStatus[]>('missions')

        if (cachedTasks && cachedMissions) {
          setTasks(cachedTasks)
          setMissions(cachedMissions)
          setTasksLoading(false)
          setMissionsLoading(false)
          console.log('[HomePage] Loaded tasks/missions from cache')
          return
        }

        // Optimized: get answered survey IDs from user document (80% read reduction)
        let answeredIds = new Set<string>()
        if (userData?.answeredSurveyIds && Array.isArray(userData.answeredSurveyIds)) {
          answeredIds = new Set(userData.answeredSurveyIds)
        } else {
          // Fallback: query surveyResponses if answeredSurveyIds field doesn't exist yet
          const responsesQuery = query(
            collection(db, 'surveyResponses'),
            where('userId', '==', currentUser.uid)
          )
          const responsesSnap = await getDocs(responsesQuery)
          answeredIds = new Set(responsesSnap.docs.map(d => d.data().surveyId))
        }

        // Fetch tasks and missions in parallel
        const [tasksSnap, missionsSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'surveys'),
            where('status', '==', 'active'),
            where('category', '==', 'task'),
            orderBy('createdAt', 'desc'),
            limit(5)
          )),
          getDocs(query(
            collection(db, 'surveys'),
            where('status', '==', 'active'),
            where('category', '==', 'mission'),
            orderBy('createdAt', 'desc'),
            limit(5)
          )),
        ])

        const taskList: SurveyWithStatus[] = []
        tasksSnap.forEach((docSnap) => {
          const data = docSnap.data() as Survey
          taskList.push({ id: docSnap.id, ...data, isAnswered: answeredIds.has(docSnap.id) })
        })
        setTasks(taskList)
        setTasksLoading(false)
        CacheService.set('tasks', taskList, 5 * 60 * 1000) // Cache for 5 minutes

        const missionList: SurveyWithStatus[] = []
        missionsSnap.forEach((docSnap) => {
          const data = docSnap.data() as Survey
          missionList.push({ id: docSnap.id, ...data, isAnswered: answeredIds.has(docSnap.id) })
        })
        setMissions(missionList)
        setMissionsLoading(false)
        CacheService.set('missions', missionList, 5 * 60 * 1000) // Cache for 5 minutes

        // Check login bonus availability (JST date, matching Cloud Function logic)
        const now = new Date()
        const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
        const today = jst.toISOString().split('T')[0]
        setLoginBonusAvailable(userData.lastLoginDate !== today)
      } catch (error) {
        console.error('Error fetching tasks/missions:', error)
      } finally {
        setTasksLoading(false)
        setMissionsLoading(false)
      }
    }

    fetchTasksAndMissions()
  }, [currentUser, userData])

  // Handle login bonus claim
  const handleClaimLoginBonus = async () => {
    if (!currentUser || !userData || claimingBonus || !loginBonusAvailable) return

    setClaimingBonus(true)
    try {
      const { awardLoginBonus } = await import('@/lib/pointService')
      const result = await awardLoginBonus()
      if (result.success && result.points) {
        setRewardPoints(result.points)
        setRewardReason('本日のログインボーナス（＋1🎫チケット）')
        setShowRewardModal(true)
        setLoginBonusAvailable(false)
        refreshUserData?.()
      }
    } catch (error) {
      console.error('Error claiming login bonus:', error)
    } finally {
      setClaimingBonus(false)
    }
  }

  // Mark notification as read (using subcollection for cost optimization)
  const markAsRead = async (notifId: string) => {
    if (!currentUser) return
    // Check if already read
    const notif = notifications.find(n => n.id === notifId)
    if (notif?.isRead) return

    try {
      // Set read status in subcollection
      await setDoc(
        doc(db, 'notifications', notifId, 'readStatus', currentUser.uid),
        {
          readAt: serverTimestamp(),
          pointsClaimed: false
        }
      )
      setNotifications(prev => prev.map(n =>
        n.id === notifId ? { ...n, isRead: true } : n
      ))
      // Update unread count
      setTotalUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const mainRef = useRef<HTMLElement>(null)
  const pointRef = useRef<HTMLSpanElement>(null)
  const [initialLoad, setInitialLoad] = useState(true)

  // Animate cards on mount
  useEffect(() => {
    if (userData && mainRef.current && initialLoad) {
      const cards = mainRef.current.querySelectorAll('.animate-card')

      // anime.js失敗時のフォールバック
      const fallbackTimeout = setTimeout(() => {
        cards.forEach(card => {
          (card as HTMLElement).style.opacity = '1'
        })
      }, 100)

      try {
        animate(cards, {
          opacity: [0, 1],
          translateY: [30, 0],
          duration: 600,
          delay: stagger(80, { start: 200 }),
          ease: 'outQuart',
        })
        clearTimeout(fallbackTimeout)
      } catch (err) {
        console.error('Animation failed:', err)
        // フォールバックが要素を表示
      }

      setInitialLoad(false)
    }
  }, [userData, initialLoad])

  // Show loading state
  if (!userData) {
    return (
      <PageLoader loading={true}>
        <div />
      </PageLoader>
    )
  }

  const isAdmin = userData.role === 'admin' || userData.role === 'staff'
  const incompleteTasks = tasks.filter(t => !t.isAnswered).length
  const incompleteMissions = missions.filter(m => !m.isAnswered).length

  return (
    <>
      {/* Login Bonus Reward Modal */}
      <PointRewardModal
        isOpen={showRewardModal}
        points={rewardPoints}
        reason={rewardReason}
        onClose={() => setShowRewardModal(false)}
      />

      <div className="min-h-screen bg-hatofes-bg pb-20">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />

        <main ref={mainRef} className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Countdown Timer */}
          <div className="animate-card opacity-0">
            <CountdownTimer variant="default" />
          </div>

          {/* Admin Banner */}
          {isAdmin && (
            <Link to="/admin" className="block animate-card opacity-0">
              <div className="bg-gradient-to-r from-hatofes-accent-yellow/20 to-hatofes-accent-yellow/10 border border-hatofes-accent-yellow/50 rounded-lg p-4 flex items-center justify-between hover:from-hatofes-accent-yellow/30 hover:to-hatofes-accent-yellow/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-hatofes-accent-yellow/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-hatofes-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-hatofes-white font-bold text-sm">管理者パネル</p>
                    <p className="text-hatofes-gray text-xs">ポイント管理・アンケート作成</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-hatofes-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )}

          {/* Point Meter - Clickable */}
          <Link to="/point" className="block animate-card opacity-0">
            <section className="card card-glow hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
              <p className="text-lg text-hatofes-white text-center mb-3 font-bold">現在の鳩ポイント</p>

              {/* Orange gradient border box */}
              <div
                className="rounded-lg p-4 mb-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,195,0,0.12), rgba(255,78,0,0.12))',
                  border: '2px solid transparent',
                  backgroundImage: 'linear-gradient(var(--color-bg-card), var(--color-bg-card)), linear-gradient(135deg, #FFC300, #FF4E00)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                }}
              >
                  <div className="flex items-baseline justify-center">
                    <span ref={pointRef} className="font-display text-5xl font-bold text-gradient">
                      <AnimatedNumber value={userData.totalPoints} duration={1200} />
                    </span>
                    <span className="text-xl ml-1 text-hatofes-gray-light font-display">pt</span>
                  </div>
                </div>

              <div className="flex items-center justify-between text-xs text-hatofes-gray">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  リアルタイム同期中
                </span>
                <span className="text-hatofes-accent-yellow font-din tracking-wide">Show detail →</span>
              </div>
            </section>
          </Link>

          {/* Level Display */}
          {(() => {
            const level = calculateLevel(userData.totalPoints)
            const progress = getPointsToNextLevel(userData.totalPoints)
            const title = LEVEL_TITLES[level]
            const colors = LEVEL_COLORS[level]

            return (
              <Link to="/level" className="block animate-card opacity-0">
                <section className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-2xl font-bold font-display"
                        style={{
                          background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        Lv.{level}
                      </span>
                      <span
                        className="text-sm font-bold font-display tracking-wide"
                        style={{
                          background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {title}
                      </span>
                    </div>
                    <span className="text-hatofes-gray text-xs font-din tracking-wide">Show detail →</span>
                  </div>
                  {progress && (
                    <div className="w-full h-3 bg-hatofes-dark rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full animate-level-bar"
                        style={{
                          '--bar-width': `${progress.progress}%`,
                          background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                        } as React.CSSProperties}
                      />
                    </div>
                  )}
                </section>
              </Link>
            )
          })()}

          {/* Login Bonus - 常に表示、状態で見た目を変更 */}
          <section className={`card animate-card opacity-0 ${
            loginBonusAvailable
              ? 'border border-hatofes-accent-yellow/40 bg-gradient-to-r from-hatofes-accent-yellow/10 to-transparent animate-pulse-border'
              : 'border border-gray-600/40 bg-gradient-to-r from-gray-600/5 to-transparent'
          }`}>
            <button
              onClick={loginBonusAvailable ? handleClaimLoginBonus : undefined}
              disabled={claimingBonus || !loginBonusAvailable}
              className="w-full flex items-center justify-between group cursor-pointer disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <span className={`text-2xl ${loginBonusAvailable ? 'group-hover:scale-110 transition-transform' : 'opacity-50'}`}>
                  {loginBonusAvailable ? '🎁' : '✓'}
                </span>
                <div className="text-left">
                  <p className={`font-bold text-sm ${loginBonusAvailable ? 'text-hatofes-white' : 'text-hatofes-gray'}`}>
                    {loginBonusAvailable ? '今日のログインボーナス' : '本日のログインボーナス'}
                  </p>
                  <p className="text-xs text-hatofes-gray">
                    {claimingBonus
                      ? '受け取り中...'
                      : loginBonusAvailable
                        ? '1日1回のボーナスを受け取る'
                        : '受け取り済み（明日また来てね！）'
                    }
                  </p>
                </div>
              </div>
              {loginBonusAvailable && (
                <span className="point-badge group-hover:scale-105 transition-transform">10pt＋🎫</span>
              )}
              {!loginBonusAvailable && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  受取済み
                </span>
              )}
            </button>
          </section>

          {/* Notifications */}
          <section className="card animate-card opacity-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-hatofes-white">新着通知</h2>
              {totalUnreadCount > 0 && (
                <span className="notification-badge">{totalUnreadCount}</span>
              )}
            </div>

            {notificationsLoading ? (
              <div className="flex justify-center py-4"><Spinner size="md" /></div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-hatofes-gray text-center py-4">通知はありません</p>
            ) : (
              <ul className="space-y-2">
                {notifications.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/notifications/${item.id}`}
                      onClick={() => markAsRead(item.id)}
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-hatofes-dark transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!item.isRead && (
                            <span className="w-2 h-2 bg-hatofes-accent-orange rounded-full flex-shrink-0" />
                          )}
                          <span className={`text-sm truncate ${item.isRead ? 'text-hatofes-gray' : 'text-hatofes-white font-bold'}`}>
                            {item.title}
                          </span>
                        </div>
                        {item.senderName && (
                          <p className="text-xs text-hatofes-gray mt-0.5 ml-4 font-display">by {item.senderName}</p>
                        )}
                      </div>
                      <ChevronRightIcon />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Link to="/notifications" className="block mt-4">
              <div className="w-full py-2.5 text-center text-sm rounded-lg border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow hover:text-hatofes-accent-yellow transition-colors flex items-center justify-center gap-2 font-din tracking-wide">
                Show more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </section>

          {/* Tasks Section */}
          <section className="card animate-card opacity-0">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #FFC300, #FF4E00)' }}></span>
                <h2 className="font-bold text-hatofes-white font-display">Task</h2>
              </div>
              {incompleteTasks > 0 && (
                <span className="notification-badge">{incompleteTasks}</span>
              )}
            </div>
            <p className="text-xs text-hatofes-gray mb-3">全員対象のタスクです</p>

            {tasksLoading ? (
              <div className="flex justify-center py-4"><Spinner size="md" /></div>
            ) : (
              <ul className="space-y-2">
                {tasks.slice(0, 5).map((task) => (
                  <li key={task.id} className={task.isAnswered ? 'opacity-60' : ''}>
                    <Link
                      to={`/tasks/${task.id}`}
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-hatofes-dark transition-colors"
                    >
                      <span className={`text-sm truncate flex-1 ${task.isAnswered ? 'text-hatofes-gray line-through' : 'text-hatofes-white'}`}>
                        {task.title}
                      </span>
                      <span className={task.isAnswered ? 'text-hatofes-gray text-sm' : 'point-badge ml-2'}>
                        {task.isAnswered ? `✓ ${task.points}pt` : `${task.points}pt`}
                      </span>
                    </Link>
                  </li>
                ))}
                {tasks.length === 0 && (
                  <li className="text-sm text-hatofes-gray text-center py-2">タスクはありません</li>
                )}
              </ul>
            )}

            <Link to="/tasks" className="block mt-4">
              <div className="w-full py-2.5 text-center text-sm rounded-lg border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow hover:text-hatofes-accent-yellow transition-colors flex items-center justify-center gap-2 font-din tracking-wide">
                Show more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </section>

          {/* Missions Section */}
          <section className="card animate-card opacity-0">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #FFC300, #FF4E00)' }}></span>
                <h2 className="font-bold text-hatofes-white font-display">Mission</h2>
              </div>
              {incompleteMissions > 0 && (
                <span className="notification-badge">{incompleteMissions}</span>
              )}
            </div>
            <p className="text-xs text-hatofes-gray mb-3">任意参加のミッションです</p>

            {missionsLoading ? (
              <div className="flex justify-center py-4"><Spinner size="md" /></div>
            ) : (
              <ul className="space-y-2">
                {missions.slice(0, 5).map((mission) => (
                  <li key={mission.id} className={mission.isAnswered ? 'opacity-60' : ''}>
                    <Link
                      to={`/missions/${mission.id}`}
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-hatofes-dark transition-colors"
                    >
                      <span className={`text-sm truncate flex-1 ${mission.isAnswered ? 'text-hatofes-gray line-through' : 'text-hatofes-white'}`}>
                        {mission.title}
                      </span>
                      <span className={mission.isAnswered ? 'text-hatofes-gray text-sm' : 'point-badge ml-2'}>
                        {mission.isAnswered ? `✓ ${mission.points}pt` : `${mission.points}pt`}
                      </span>
                    </Link>
                  </li>
                ))}
                {missions.length === 0 && (
                  <li className="text-sm text-hatofes-gray text-center py-2">ミッションはありません</li>
                )}
              </ul>
            )}

            <Link to="/missions" className="block mt-4">
              <div className="w-full py-2.5 text-center text-sm rounded-lg border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow hover:text-hatofes-accent-yellow transition-colors flex items-center justify-center gap-2 font-din tracking-wide">
                Show more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </section>

          {/* Festival Day Features - Conditional based on feature toggles */}
          {(featureToggles.boothsEnabled || featureToggles.eventsEnabled) && (
            <div className="grid grid-cols-2 gap-3">
              {featureToggles.boothsEnabled && (
                <Link to="/booths" className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
                  <div className="text-center py-2">
                    <span className="text-3xl block mb-2">🏪</span>
                    <p className="text-hatofes-white font-bold text-sm">ブース一覧</p>
                    <p className="text-xs text-hatofes-gray">出展情報を見る</p>
                  </div>
                </Link>
              )}
              {featureToggles.eventsEnabled && (
                <Link to="/events" className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
                  <div className="text-center py-2">
                    <span className="text-3xl block mb-2">📅</span>
                    <p className="text-hatofes-white font-bold text-sm">スケジュール</p>
                    <p className="text-xs text-hatofes-gray">イベント情報</p>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Radio Banner - Conditional */}
          {featureToggles.radioEnabled && (
            <Link to="/radio" className="block">
              <section className="card hover:ring-1 hover:ring-red-500 transition-all bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📻</span>
                    <div>
                      <p className="text-hatofes-white font-bold">鳩ラジ</p>
                      <p className="text-xs text-hatofes-gray">校内ラジオを聴く</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-hatofes-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </section>
            </Link>
          )}

          {/* Gacha Banner */}
          <Link to="/gacha" className="block animate-card opacity-0">
            <section className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎰</span>
                  <div>
                    <p className="text-hatofes-white font-bold">ガチャガチャ</p>
                    <p className="text-xs text-hatofes-gray">チケット残数: <span className="text-hatofes-accent-yellow font-bold">{userData.gachaTickets ?? 0}枚</span></p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-hatofes-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </section>
          </Link>

          {/* Executive Q&A Banner - Conditional */}
          {featureToggles.executiveQAEnabled && (
            <Link to="/executive" className="block">
              <section className="card hover:ring-1 hover:ring-purple-500 transition-all bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">👑</span>
                    <div>
                      <p className="text-hatofes-white font-bold">三役Q&A</p>
                      <p className="text-xs text-hatofes-gray">三役に質問しよう！</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-hatofes-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </section>
            </Link>
          )}

          {/* Tetris Banner - 教員以外のみ表示 */}
          {userData.role !== 'teacher' && (
            <Link to="/tetris" className="block animate-card opacity-0">
              <section className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🧱</span>
                    <div>
                      <p className="text-hatofes-white font-bold">テトリス</p>
                      <p className="text-xs text-hatofes-gray">行消しでポイント獲得</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-hatofes-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </section>
            </Link>
          )}


        </main>
      </div>
    </>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4 text-hatofes-gray flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

// Inline styles for animations
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animate-gradient-shift {
    background-size: 200% 200%;
    animation: gradient-shift 3s ease infinite;
  }
  @keyframes pulse-border {
    0%, 100% { border-color: rgba(255, 195, 0, 0.4); }
    50% { border-color: rgba(255, 195, 0, 0.8); }
  }
  .animate-pulse-border {
    animation: pulse-border 2s ease-in-out infinite;
  }
  @keyframes level-bar-fill {
    from { width: 0; }
    to { width: var(--bar-width); }
  }
  .animate-level-bar {
    animation: level-bar-fill 1s ease-out forwards;
  }
`
if (!document.querySelector('#home-page-styles')) {
  styleSheet.id = 'home-page-styles'
  document.head.appendChild(styleSheet)
}
