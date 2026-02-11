import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, limit, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { animate, stagger } from 'animejs'
import { db } from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import { PageLoader, AnimatedNumber } from '@/components/ui/PageLoader'
import { Spinner } from '@/components/ui/Spinner'
import { calculateLevel, getPointsToNextLevel, LEVEL_TITLES, LEVEL_COLORS } from '@/lib/levelSystem'
import type { Survey, Notification as NotificationType } from '@/types/firestore'

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
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(true)
  const [missionsLoading, setMissionsLoading] = useState(true)

  // Fetch notifications with server-side filtering (optimized)
  useEffect(() => {
    if (!currentUser || !userData) return

    const fetchNotifications = async () => {
      try {
        const notifQuery = query(
          collection(db, 'notifications'),
          where('targetRoles', 'array-contains', userData.role),
          orderBy('createdAt', 'desc'),
          limit(3)
        )
        const notifSnap = await getDocs(notifQuery)
        const notifList: NotificationWithStatus[] = notifSnap.docs.map((docSnap) => {
          const data = docSnap.data() as NotificationType
          return {
            id: docSnap.id,
            ...data,
            isRead: data.readBy?.includes(currentUser.uid) || false,
          }
        })
        setNotifications(notifList)
      } catch (error) {
        console.error('Error fetching notifications:', error)
      } finally {
        setNotificationsLoading(false)
      }
    }

    fetchNotifications()
  }, [currentUser, userData])

  // Fetch tasks and missions (shared surveyResponses fetch)
  useEffect(() => {
    if (!currentUser || !userData) return

    const fetchTasksAndMissions = async () => {
      try {
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

        const missionList: SurveyWithStatus[] = []
        missionsSnap.forEach((docSnap) => {
          const data = docSnap.data() as Survey
          missionList.push({ id: docSnap.id, ...data, isAnswered: answeredIds.has(docSnap.id) })
        })
        setMissions(missionList)
        setMissionsLoading(false)

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

  // Mark notification as read
  const markAsRead = async (notifId: string) => {
    if (!currentUser) return
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        readBy: arrayUnion(currentUser.uid)
      })
      setNotifications(prev => prev.map(n =>
        n.id === notifId ? { ...n, isRead: true } : n
      ))
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
  const unreadNotifications = notifications.filter(n => !n.isRead).length
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
            <section className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all relative overflow-hidden">
              {/* Animated gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-hatofes-accent-yellow/5 via-transparent to-hatofes-accent-orange/5 animate-gradient-shift" />

              <div className="relative">
                <p className="text-lg text-hatofes-white text-center mb-3 font-bold">現在の鳩ポイント</p>

                {/* Orange gradient border box */}
                <div
                  className="rounded-lg p-4 mb-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,195,0,0.15), rgba(255,78,0,0.15))',
                    border: '2px solid transparent',
                    backgroundImage: 'linear-gradient(#1a1a2e, #1a1a2e), linear-gradient(135deg, #FFC300, #FF4E00)',
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
                  <span className="text-hatofes-accent-yellow font-display">Show More →</span>
                </div>
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
                    <span className="text-hatofes-gray text-xs font-display">Details →</span>
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
                  Claimed
                </span>
              )}
            </button>
          </section>

          {/* Notifications */}
          <section className="card animate-card opacity-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-hatofes-white">新着通知</h2>
              {unreadNotifications > 0 && (
                <span className="notification-badge">{unreadNotifications}</span>
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
              <div className="w-full py-2.5 text-center text-sm rounded-lg border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow hover:text-hatofes-accent-yellow transition-colors flex items-center justify-center gap-2 font-display">
                Show More
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
                {tasks.filter(t => !t.isAnswered).slice(0, 3).map((task) => (
                  <li key={task.id}>
                    <Link
                      to={`/tasks/${task.id}`}
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-hatofes-dark transition-colors"
                    >
                      <span className="text-sm text-hatofes-white truncate flex-1">{task.title}</span>
                      <span className="point-badge ml-2">{task.points}pt</span>
                    </Link>
                  </li>
                ))}
                {tasks.filter(t => !t.isAnswered).length === 0 && (
                  <li className="text-sm text-hatofes-gray text-center py-2">未完了のタスクはありません</li>
                )}
              </ul>
            )}

            <Link to="/tasks" className="block mt-4">
              <div className="w-full py-2.5 text-center text-sm rounded-lg border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow hover:text-hatofes-accent-yellow transition-colors flex items-center justify-center gap-2 font-display">
                Show More
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
                {missions.filter(m => !m.isAnswered).slice(0, 3).map((mission) => (
                  <li key={mission.id}>
                    <Link
                      to={`/missions/${mission.id}`}
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-hatofes-dark transition-colors"
                    >
                      <span className="text-sm text-hatofes-white truncate flex-1">{mission.title}</span>
                      <span className="point-badge ml-2">{mission.points}pt</span>
                    </Link>
                  </li>
                ))}
                {missions.filter(m => !m.isAnswered).length === 0 && (
                  <li className="text-sm text-hatofes-gray text-center py-2">挑戦できるミッションはありません</li>
                )}
              </ul>
            )}

            <Link to="/missions" className="block mt-4">
              <div className="w-full py-2.5 text-center text-sm rounded-lg border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow hover:text-hatofes-accent-yellow transition-colors flex items-center justify-center gap-2 font-display">
                Show More
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </section>

          {/* Gacha Banner */}
          <Link to="/gacha" className="block animate-card opacity-0">
            <section className="card bg-gradient-to-r from-hatofes-accent-yellow/10 to-hatofes-accent-orange/10 border border-hatofes-accent-yellow/40 hover:border-hatofes-accent-yellow/70 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎰</span>
                  <div>
                    <p className="text-hatofes-white font-bold">ガチャガチャ</p>
                    <p className="text-xs text-hatofes-gray">チケット残数: <span className="text-hatofes-accent-yellow font-bold">{userData.gachaTickets ?? 0}枚</span></p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-hatofes-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </section>
          </Link>

          {/* Tetris Banner - 教員以外のみ表示 */}
          {userData.role !== 'teacher' && (
            <Link to="/tetris" className="block animate-card opacity-0">
              <section className="card bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/40 hover:border-blue-500/70 transition-all hover:scale-[1.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🧱</span>
                    <div>
                      <p className="text-hatofes-white font-bold">テトリス</p>
                      <p className="text-xs text-hatofes-gray">行消しでポイント獲得</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
