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
import { TetrisIcon, GachaIcon, RadioIcon, QAIcon, ChevronRightIcon as ChevronIcon, BellIcon, TaskIcon, MissionIcon } from '@/components/ui/Icon'
import { ViewMoreButton, PointBadge } from '@/components/ui/Button'
import { hapticMedium } from '@/lib/haptics'
import { STREAK_MILESTONES } from '@/lib/badgeSystem'
import { RoleBadge, getRoleDisplayLabel } from '@/lib/roleDisplay'
import type { Survey, Notification as NotificationType } from '@/types/firestore'

interface FeatureToggles {
  boothsEnabled: boolean
  eventsEnabled: boolean
  radioEnabled: boolean
  executiveQAEnabled: boolean
}

type SurveyWithStatus = Survey & { id: string; isAnswered: boolean }
type NotificationWithStatus = NotificationType & { id: string; isRead: boolean }

function getJstDateString(nowMs: number) {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function getMsUntilNextJstMidnight(nowMs: number) {
  const dayMs = 24 * 60 * 60 * 1000
  const jstOffsetMs = 9 * 60 * 60 * 1000
  const elapsedTodayJst = (nowMs + jstOffsetMs) % dayMs
  const remainingMs = dayMs - elapsedTodayJst
  return Math.max(1000, remainingMs)
}

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
  const [, setStreakInfo] = useState<{ streak: number; bonus: number; newBadge: string | null } | null>(null)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(true)
  const [missionsLoading, setMissionsLoading] = useState(true)
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [todayJst, setTodayJst] = useState(() => getJstDateString(Date.now()))
  const [tetrisNeedsAttention, setTetrisNeedsAttention] = useState(false)
  const [streakMilestones, setStreakMilestones] = useState<Record<number, number>>(STREAK_MILESTONES)

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

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'loginBonus'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as { streakMilestones?: Record<string, number> }
        const nextMilestones = Object.entries(data.streakMilestones || {}).reduce<Record<number, number>>((acc, [key, value]) => {
          const day = Number(key)
          if (Number.isFinite(day) && typeof value === 'number') {
            acc[day] = value
          }
          return acc
        }, {})
        if (Object.keys(nextMilestones).length > 0) {
          setStreakMilestones(nextMilestones)
        }
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const updateNow = () => {
      setNowMs(Date.now())
    }

    updateNow()
    const intervalId = window.setInterval(updateNow, 60 * 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    let timeoutId: number

    const scheduleNext = () => {
      const now = Date.now()
      setTodayJst(getJstDateString(now))
      timeoutId = window.setTimeout(scheduleNext, getMsUntilNextJstMidnight(now))
    }

    scheduleNext()
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    const lastOpened = window.localStorage.getItem('hatofes:last-opened-tetris')
    setTetrisNeedsAttention(lastOpened !== todayJst)
  }, [todayJst])

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

      } catch (error) {
        console.error('Error fetching tasks/missions:', error)
      } finally {
        setTasksLoading(false)
        setMissionsLoading(false)
      }
    }

    fetchTasksAndMissions()
  }, [currentUser, userData])

  useEffect(() => {
    if (!userData) return
    setLoginBonusAvailable(userData.lastLoginDate !== todayJst)
  }, [userData, todayJst])

  // Handle login bonus claim
  const handleClaimLoginBonus = async () => {
    if (!currentUser || !userData || claimingBonus || !loginBonusAvailable) return

    setClaimingBonus(true)
    try {
      const { awardLoginBonus } = await import('@/lib/pointService')
      hapticMedium()
      const result = await awardLoginBonus()
      if (result.success && result.points) {
        const data = result as { success: boolean; points: number; streak?: number; streakBonus?: number; newBadge?: string | null }
        const streak = data.streak || 1
        const streakBonus = data.streakBonus || 0
        const reason = streakBonus > 0
          ? `ログインボーナス + ${streak}日連続ボーナス🔥（＋1🎫チケット）`
          : '本日のログインボーナス（＋1🎫チケット）'
        setRewardPoints(result.points)
        setRewardReason(reason)
        setShowRewardModal(true)
        setLoginBonusAvailable(false)
        setStreakInfo({ streak, bonus: streakBonus, newBadge: data.newBadge || null })
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
  const nextResetAt = getMsUntilNextJstMidnight(nowMs)
  const resetHours = Math.floor(nextResetAt / (1000 * 60 * 60))
  const resetMinutes = Math.floor((nextResetAt % (1000 * 60 * 60)) / (1000 * 60))
  const level = calculateLevel(userData.totalPoints)
  const progress = getPointsToNextLevel(userData.totalPoints)
  const title = LEVEL_TITLES[level]
  const colors = LEVEL_COLORS[level]
  const quickLinks = [
    {
      to: '/notifications',
      label: '通知',
      note: totalUnreadCount > 0 ? `${totalUnreadCount}件の未読` : '新着を確認',
      icon: <BellIcon size={24} />,
      iconTone: 'bg-hatofes-accent-yellow/12 text-hatofes-accent-yellow',
      badge: totalUnreadCount > 0 ? totalUnreadCount : null,
      visible: true,
    },
    {
      to: '/tasks',
      label: 'Task',
      note: incompleteTasks > 0 ? `${incompleteTasks}件が未回答` : '全員対象のタスク',
      icon: <TaskIcon size={24} />,
      iconTone: 'bg-emerald-500/12 text-emerald-300',
      badge: incompleteTasks > 0 ? incompleteTasks : null,
      visible: true,
    },
    {
      to: '/missions',
      label: 'Mission',
      note: incompleteMissions > 0 ? `${incompleteMissions}件が未完了` : '自由参加ミッション',
      icon: <MissionIcon size={24} />,
      iconTone: 'bg-sky-500/12 text-sky-300',
      badge: incompleteMissions > 0 ? incompleteMissions : null,
      visible: true,
    },
    {
      to: '/gacha',
      label: 'ガチャ',
      note: 'チケットで抽選',
      icon: <GachaIcon size={26} />,
      iconTone: 'bg-fuchsia-500/12 text-fuchsia-300',
      badge: (userData.gachaTickets ?? 0) > 0 ? userData.gachaTickets : null,
      visible: true,
    },
    {
      to: '/tetris',
      label: 'テトリス',
      note: '行消しでポイント獲得',
      icon: <TetrisIcon size={26} />,
      iconTone: 'bg-cyan-500/12 text-cyan-300',
      badge: tetrisNeedsAttention ? '!' : null,
      visible: userData.role !== 'teacher',
    },
    {
      to: '/gacha/collection',
      label: '図鑑',
      note: 'コレクション進捗',
      icon: <GachaIcon size={26} />,
      iconTone: 'bg-violet-500/12 text-violet-300',
      badge: null,
      visible: true,
    },
    {
      to: '/radio',
      label: '鳩ラジ',
      note: '校内ラジオを聴く',
      icon: <RadioIcon size={26} gradient={false} color="#EF4444" />,
      iconTone: 'bg-red-500/12 text-red-300',
      badge: null,
      visible: featureToggles.radioEnabled,
    },
    {
      to: '/executive',
      label: '三役Q&A',
      note: '三役に質問しよう',
      icon: <QAIcon size={26} gradient={false} color="#A855F7" />,
      iconTone: 'bg-purple-500/12 text-purple-300',
      badge: null,
      visible: featureToggles.executiveQAEnabled,
    },
  ].filter(link => link.visible)
  const supportLinks = [
    featureToggles.boothsEnabled
      ? { to: '/booths', emoji: '🏪', title: 'ブース一覧', note: '出展情報を見る' }
      : null,
    featureToggles.eventsEnabled
      ? { to: '/events', emoji: '📅', title: 'スケジュール', note: 'イベント情報' }
      : null,
    featureToggles.boothsEnabled
      ? { to: '/stamp-rally', emoji: '🗺️', title: 'スタンプラリー', note: 'ブースを巡ろう' }
      : null,
    { to: '/live-challenge', emoji: '⚡', title: 'タイムアタック', note: 'クラス対抗チャレンジ' },
  ].filter(Boolean) as { to: string; emoji: string; title: string; note: string }[]
  const redBadgeClass = 'inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-[#e24d4d] px-1.5 text-[11px] font-bold text-white'
  const featuredNotifications = [
    ...notifications.filter(item => item.isImportant),
    ...notifications.filter(item => !item.isImportant),
  ].slice(0, 3)
  return (
    <>
      {/* Login Bonus Reward Modal */}
      <PointRewardModal
        isOpen={showRewardModal}
        points={rewardPoints}
        reason={rewardReason}
        onClose={() => setShowRewardModal(false)}
      />

      <div className="home-dashboard min-h-screen theme-bg pb-16">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />

        <main ref={mainRef} className="mx-auto max-w-7xl px-3 pb-8 pt-3 sm:px-4 lg:px-6">
          <section className="home-panel overflow-hidden rounded-[1.35rem] px-3 py-3 text-white shadow-[0_30px_80px_rgba(16,22,26,0.22)] sm:rounded-[1.6rem] sm:px-5 sm:py-4 lg:px-6 lg:py-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_360px]">
              <div className="space-y-5">
                <section className="home-card animate-card opacity-0 rounded-[1.25rem] p-3 sm:p-5">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[11px] font-din uppercase tracking-[0.32em] text-white/45">Overview</p>
                        <h1 className="mt-2 text-2xl font-medium leading-tight sm:text-4xl">
                          Welcome, <span className="font-bold">{userData.username}</span>
                        </h1>
                      </div>

                      <div className="home-subcard rounded-[1rem] p-2 lg:min-w-[360px]">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="home-subcard flex min-h-[84px] flex-col justify-center rounded-[0.8rem] px-3 py-3 text-center">
                            <p className="text-[10px] font-din uppercase tracking-[0.25em] text-white/35">Grade</p>
                            <p className="mt-2 text-base font-semibold">{userData.grade}年</p>
                          </div>
                          <div className="home-subcard flex min-h-[84px] flex-col justify-center rounded-[0.8rem] px-3 py-3 text-center">
                            <p className="text-[10px] font-din uppercase tracking-[0.25em] text-white/35">Class</p>
                            <p className="mt-2 text-base font-semibold">{userData.class}組</p>
                          </div>
                          <div className="home-subcard flex min-h-[84px] flex-col items-center justify-center rounded-[0.8rem] px-3 py-3 text-center">
                            <p className="text-[10px] font-din uppercase tracking-[0.25em] text-white/35">Role</p>
                            <div className="mt-2 flex justify-center">
                              <RoleBadge role={userData.role} department={userData.department} size="sm" />
                            </div>
                          </div>
                          <div className="home-subcard flex min-h-[84px] flex-col justify-center rounded-[0.8rem] px-3 py-3 text-center">
                            <p className="text-[10px] font-din uppercase tracking-[0.25em] text-white/35">Tickets</p>
                            <p className="mt-2 text-base font-semibold">{userData.gachaTickets ?? 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
                      <Link to="/point" className="home-card rounded-[1.1rem] p-4 text-white transition-transform hover:-translate-y-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-din uppercase tracking-[0.25em] text-white/42">Points Balance</p>
                            <div className="mt-4 flex items-end gap-2">
                              <span
                                ref={pointRef}
                                className="font-display text-4xl font-bold leading-none sm:text-6xl"
                                style={{
                                  background: 'linear-gradient(135deg, #FFC300, #FF7A18)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                }}
                              >
                                <AnimatedNumber value={userData.totalPoints} duration={1200} />
                              </span>
                              <span className="pb-1 text-lg font-display text-white/52">pt</span>
                            </div>
                          </div>
                          <span className="flex items-center gap-1 text-[11px] font-din uppercase tracking-[0.2em] text-white/46">
                            Detail
                            <ChevronIcon size={14} color="#D1D5DB" />
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5">
                          <div className="home-subcard rounded-[0.95rem] px-3 py-3">
                            <p className="text-[10px] font-din uppercase tracking-[0.22em] text-white/38">Unread</p>
                            <p className="mt-2 text-lg font-semibold text-white sm:text-xl">{totalUnreadCount}</p>
                          </div>
                          <div className="home-subcard rounded-[0.95rem] px-3 py-3">
                            <p className="text-[10px] font-din uppercase tracking-[0.22em] text-white/38">Task</p>
                            <p className="mt-2 text-lg font-semibold text-white sm:text-xl">{incompleteTasks}</p>
                          </div>
                          <div className="home-subcard rounded-[0.95rem] px-3 py-3">
                            <p className="text-[10px] font-din uppercase tracking-[0.22em] text-white/38">Mission</p>
                            <p className="mt-2 text-lg font-semibold text-white sm:text-xl">{incompleteMissions}</p>
                          </div>
                        </div>
                      </Link>

                      <Link to="/level" className="home-card rounded-[1.1rem] p-4 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-din uppercase tracking-[0.25em] text-white/42">Level</p>
                            <div className="mt-3 flex items-end gap-2">
                              <p
                                className="text-4xl font-black font-display leading-none sm:text-5xl"
                                style={{
                                  background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                }}
                              >
                                Lv.{level}
                              </p>
                            </div>
                            <p
                              className="mt-2 text-[1.35rem] font-black font-display leading-none tracking-[0.08em] sm:text-[1.85rem]"
                              style={{
                                background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                              }}
                            >
                              {title}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span
                                className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-din uppercase tracking-[0.18em]"
                                style={{ backgroundColor: `${colors.from}26`, color: colors.from }}
                              >
                                Title
                              </span>
                            </div>
                          </div>
                          <span className="flex items-center gap-1 text-[11px] font-din uppercase tracking-[0.2em] text-white/46">
                            Detail
                            <ChevronIcon size={14} color="#D1D5DB" />
                          </span>
                        </div>
                        {progress ? (
                          <>
                            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/8">
                              <div
                                className="h-full rounded-full animate-level-bar"
                                style={{
                                  '--bar-width': `${progress.progress}%`,
                                  background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                                } as React.CSSProperties}
                              />
                            </div>
                            <p className="mt-2 text-xs text-white/48">
                              次のレベルまで {progress.next - progress.current}pt
                            </p>
                          </>
                        ) : null}
                      </Link>
                    </div>
                  </div>
                </section>

                <section className="animate-card opacity-0">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-din uppercase tracking-[0.25em] text-white/42">News Desk</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">重要なお知らせ</h2>
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-din uppercase tracking-[0.2em] text-white/48">
                      Priority
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => {
                      const item = featuredNotifications[index] ?? null
                      if (!item) {
                        return (
                          <div key={`empty-${index}`} className="home-card min-h-[88px] rounded-[1rem] p-4 text-sm text-white/44">
                            準備中
                          </div>
                        )
                      }
                      return (
                        <Link
                          key={item.id}
                          to={`/notifications/${item.id}`}
                          onClick={() => markAsRead(item.id)}
                          className="home-card min-h-[88px] rounded-[1rem] p-4 transition-colors hover:bg-white/[0.06]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
                              {item.senderName ? (
                                <p className="mt-2 text-xs text-white/42">by {item.senderName}</p>
                              ) : null}
                            </div>
                            {!item.isRead ? <span className={redBadgeClass}>!</span> : null}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </section>

                <section className="home-card animate-card opacity-0 rounded-[1.1rem] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-din uppercase tracking-[0.25em] text-white/42">Beta Feedback</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">要望・バグ報告</h2>
                      <p className="mt-2 text-sm text-white/52">
                        ベータ版で気づいた不具合や、追加してほしい機能を送れます。
                      </p>
                    </div>
                    <Link
                      to="/settings"
                      className="inline-flex h-11 items-center justify-center rounded-[1rem] bg-[#e24d4d] px-4 text-sm font-medium text-white transition-colors hover:opacity-90"
                    >
                      フォームを開く
                    </Link>
                  </div>
                </section>

                <section className="animate-card opacity-0">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {quickLinks.map(link => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className="home-card flex aspect-square min-h-[132px] flex-col rounded-[1rem] p-3 transition-all hover:-translate-y-0.5 hover:bg-white/[0.06] md:aspect-auto md:min-h-0 md:p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`flex h-12 w-12 items-center justify-center rounded-[0.9rem] ${link.iconTone} sm:h-11 sm:w-11`}>
                            {link.icon}
                          </span>
                          {link.badge ? <span className={redBadgeClass}>{link.badge}</span> : null}
                        </div>
                        <div className="mt-auto pt-3">
                          <p className="text-sm font-semibold text-white">{link.label}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/48 md:text-xs md:leading-5">{link.note}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                  <section className="home-card animate-card opacity-0 rounded-[1.1rem] p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TaskIcon size={20} />
                        <div>
                          <h2 className="font-display text-lg font-semibold text-white">Task</h2>
                          <p className="text-xs text-white/48">全員対象のタスク</p>
                        </div>
                      </div>
                      {incompleteTasks > 0 ? <span className={redBadgeClass}>{incompleteTasks}</span> : null}
                    </div>

                    {tasksLoading ? (
                      <div className="flex justify-center py-8"><Spinner size="md" /></div>
                    ) : (
                      <ul className="space-y-2">
                        {tasks.slice(0, 5).map(task => (
                          <li key={task.id} className={task.isAnswered ? 'opacity-60' : ''}>
                            <Link
                              to={`/tasks/${task.id}`}
                              className="home-subcard flex items-center justify-between gap-3 rounded-[0.95rem] px-4 py-3 transition-colors hover:bg-white/[0.06]"
                            >
                              <span className={`min-w-0 flex-1 truncate text-sm ${task.isAnswered ? 'text-white/35 line-through' : 'text-white'}`}>
                                {task.title}
                              </span>
                              <PointBadge points={task.points} completed={task.isAnswered} size="sm" />
                            </Link>
                          </li>
                        ))}
                        {tasks.length === 0 ? <li className="home-subcard rounded-[0.95rem] py-8 text-center text-sm text-white/44">タスクはありません</li> : null}
                      </ul>
                    )}

                    <ViewMoreButton to="/tasks" />
                  </section>

                  <section className="home-card animate-card opacity-0 rounded-[1.1rem] p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MissionIcon size={20} />
                        <div>
                          <h2 className="font-display text-lg font-semibold text-white">Mission</h2>
                          <p className="text-xs text-white/48">任意参加のミッション</p>
                        </div>
                      </div>
                      {incompleteMissions > 0 ? <span className={redBadgeClass}>{incompleteMissions}</span> : null}
                    </div>

                    {missionsLoading ? (
                      <div className="flex justify-center py-8"><Spinner size="md" /></div>
                    ) : (
                      <ul className="space-y-2">
                        {missions.slice(0, 5).map(mission => (
                          <li key={mission.id} className={mission.isAnswered ? 'opacity-60' : ''}>
                            <Link
                              to={`/missions/${mission.id}`}
                              className="home-subcard flex items-center justify-between gap-3 rounded-[0.95rem] px-4 py-3 transition-colors hover:bg-white/[0.06]"
                            >
                              <span className={`min-w-0 flex-1 truncate text-sm ${mission.isAnswered ? 'text-white/35 line-through' : 'text-white'}`}>
                                {mission.title}
                              </span>
                              <PointBadge points={mission.points} completed={mission.isAnswered} size="sm" />
                            </Link>
                          </li>
                        ))}
                        {missions.length === 0 ? <li className="home-subcard rounded-[0.95rem] py-8 text-center text-sm text-white/44">ミッションはありません</li> : null}
                      </ul>
                    )}

                    <ViewMoreButton to="/missions" />
                  </section>
                </div>
              </div>

              <div className="min-w-0 space-y-4 sm:space-y-5">
                <section className="home-card animate-card min-w-0 overflow-hidden opacity-0 rounded-[1.1rem] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-din uppercase tracking-[0.25em] text-white/42">Countdown</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">鳩祭タイマー</h2>
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-din uppercase tracking-[0.22em] text-white/45">
                      Live
                    </span>
                  </div>
                  <div className="sm:hidden">
                    <CountdownTimer variant="compact" className="!bg-transparent" />
                  </div>
                  <div className="hidden sm:block">
                    <CountdownTimer variant="default" className="!bg-transparent" />
                  </div>
                </section>

                <section className={`animate-card min-w-0 overflow-hidden opacity-0 rounded-[1.1rem] p-4 sm:p-5 ${loginBonusAvailable ? 'bg-[#f4efe5] text-[#11161a]' : 'home-card'}`}>
                  <button
                    onClick={loginBonusAvailable ? handleClaimLoginBonus : undefined}
                    disabled={claimingBonus || !loginBonusAvailable}
                    className="w-full text-left"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex items-start gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-[0.95rem] text-2xl ${loginBonusAvailable ? 'bg-[#11161a]/8' : 'home-subcard'}`}>
                          {loginBonusAvailable ? '🎁' : '✓'}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[11px] font-din uppercase tracking-[0.25em] ${loginBonusAvailable ? 'text-[#11161a]/42' : 'text-white/42'}`}>Daily Bonus</p>
                          <p className={`mt-2 text-lg font-semibold ${loginBonusAvailable ? 'text-[#11161a]' : 'text-white'}`}>
                            {loginBonusAvailable ? '今日のログボ受取可能' : '本日のログボ受取済み'}
                          </p>
                          <p className={`mt-1 break-words text-xs ${loginBonusAvailable ? 'text-[#11161a]/50' : 'text-white/48'}`}>
                            {claimingBonus ? '受け取り中...' : `毎日 0:00 更新 / あと ${resetHours}h ${resetMinutes}m`}
                          </p>
                        </div>
                      </div>
                      {loginBonusAvailable ? (
                        <span className="point-badge self-start sm:self-auto">10pt＋🎫</span>
                      ) : (
                        <span className="home-subcard self-start rounded-full px-3 py-1 text-[11px] font-bold text-emerald-300 sm:self-auto">
                          Claimed
                        </span>
                      )}
                    </div>
                  </button>
                </section>

                <section className="home-card animate-card min-w-0 overflow-hidden opacity-0 rounded-[1.1rem] p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-din uppercase tracking-[0.25em] text-white/42">Login Streak</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {(userData.loginStreak ?? 0) > 1 ? `${userData.loginStreak}日連続ログイン中` : '今日からストリーク開始'}
                      </p>
                      <p className="mt-1 break-words text-xs text-white/48">
                        {(() => {
                          const streak = userData.loginStreak ?? 0
                          const milestones = Object.keys(streakMilestones).map(Number).sort((a, b) => a - b)
                          const next = milestones.find(m => m > streak)
                          if (next) {
                            return `次のボーナスまであと${next - streak}日（${next}日で+${streakMilestones[next]}pt）`
                          }
                          return 'マックスストリーク達成中'
                        })()}
                      </p>
                    </div>
                    <span className="font-display text-3xl font-bold text-gradient">{userData.loginStreak ?? 1}</span>
                  </div>
                </section>

                <section className="home-card animate-card min-w-0 overflow-hidden opacity-0 rounded-[1.1rem] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BellIcon size={20} />
                      <div>
                        <h2 className="font-semibold text-white">新着通知</h2>
                        <p className="text-xs text-white/48">最新の連絡</p>
                      </div>
                    </div>
                    {totalUnreadCount > 0 ? <span className={redBadgeClass}>{totalUnreadCount}</span> : null}
                  </div>

                  {notificationsLoading ? (
                    <div className="flex justify-center py-8"><Spinner size="md" /></div>
                  ) : notifications.length === 0 ? (
                    <p className="home-subcard rounded-[0.95rem] py-8 text-center text-sm text-white/44">通知はありません</p>
                  ) : (
                    <ul className="space-y-2">
                      {notifications.slice(0, 3).map(item => (
                        <li key={item.id}>
                          <Link
                            to={`/notifications/${item.id}`}
                            onClick={() => markAsRead(item.id)}
                            className="home-subcard flex items-center justify-between gap-3 rounded-[0.95rem] px-4 py-3 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {!item.isRead ? <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#f4d45e]" /> : null}
                                <span className={`truncate text-sm ${item.isRead ? 'text-white/42' : 'font-semibold text-white'}`}>
                                  {item.title}
                                </span>
                              </div>
                              {item.senderName ? <p className="mt-1 pl-4 text-xs text-white/42">by {item.senderName}</p> : null}
                            </div>
                            <ChevronIcon size={16} color="#A3A3A3" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  <ViewMoreButton to="/notifications" />
                </section>

                <section className="home-card animate-card min-w-0 overflow-hidden opacity-0 rounded-[1.1rem] p-4 sm:p-5">
                  <div className="mb-4">
                    <h2 className="font-semibold text-white">Festival Access</h2>
                    <p className="text-xs text-white/48">当日機能と特設導線</p>
                  </div>
                  <div className="space-y-2">
                    {supportLinks.map(link => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className="home-subcard flex items-center gap-3 rounded-[0.95rem] px-4 py-3 transition-colors hover:bg-white/[0.06]"
                      >
                        <span className="text-2xl">{link.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">{link.title}</p>
                          <p className="text-xs text-white/48">{link.note}</p>
                        </div>
                        <ChevronIcon size={16} color="#A3A3A3" />
                      </Link>
                    ))}
                    {supportLinks.length === 0 ? (
                      <div className="home-subcard rounded-[0.95rem] py-8 text-center text-sm text-white/44">
                        当日機能はまだ公開されていません
                      </div>
                    ) : null}
                  </div>
                </section>

                {isAdmin ? (
                  <Link to="/admin" className="block animate-card opacity-0">
                    <div className="rounded-[1.1rem] bg-[#f4efe5] p-4 text-[#11161a] transition-transform hover:-translate-y-0.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] bg-[#11161a]/8">
                            <svg className="h-5 w-5 text-[#11161a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold">管理者パネル</p>
                            <p className="text-xs text-[#11161a]/52">{getRoleDisplayLabel(userData.role, userData.department)}として管理</p>
                          </div>
                        </div>
                        <ChevronIcon size={18} color="#11161A" />
                      </div>
                    </div>
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
