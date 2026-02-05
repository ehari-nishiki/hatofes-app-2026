import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, limit, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { usePointHistory } from '@/hooks/usePointHistory'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import { Spinner } from '@/components/ui/Spinner'
import type { Survey, Notification as NotificationType } from '@/types/firestore'

type SurveyWithStatus = Survey & { id: string; isAnswered: boolean }
type NotificationWithStatus = NotificationType & { id: string; isRead: boolean }

export default function HomePage() {
  const { currentUser, userData, refreshUserData } = useAuth()
  const { history, loading: historyLoading } = usePointHistory(currentUser?.uid || null)
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

  // Fetch notifications
  useEffect(() => {
    if (!currentUser || !userData) return

    const fetchNotifications = async () => {
      try {
        const notifQuery = query(
          collection(db, 'notifications'),
          orderBy('createdAt', 'desc'),
          limit(5)
        )
        const notifSnap = await getDocs(notifQuery)
        const notifList: NotificationWithStatus[] = []
        notifSnap.forEach((docSnap) => {
          const data = docSnap.data() as NotificationType
          if (data.targetRoles.length === 0 || data.targetRoles.includes(userData.role)) {
            notifList.push({
              id: docSnap.id,
              ...data,
              isRead: data.readBy?.includes(currentUser.uid) || false,
            })
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
        // Shared: fetch user's survey responses once
        const responsesQuery = query(
          collection(db, 'surveyResponses'),
          where('userId', '==', currentUser.uid)
        )
        const responsesSnap = await getDocs(responsesQuery)
        const answeredIds = new Set(responsesSnap.docs.map(d => d.data().surveyId))

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

  // Show loading state
  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
      </div>
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

        <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Admin Banner */}
          {isAdmin && (
            <Link to="/admin" className="block">
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
          <Link to="/point" className="block">
            <section className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm text-hatofes-white">現在の鳩ポイント</p>
                <span className="text-hatofes-gray text-xs">タップで詳細 →</span>
              </div>

              <div className="border border-hatofes-gray rounded-lg p-4 mb-2 bg-hatofes-dark">
                <div className="flex items-baseline justify-center">
                  <span className="font-display text-5xl font-bold text-gradient">
                    {userData.totalPoints.toLocaleString()}
                  </span>
                  <span className="text-xl ml-1 text-hatofes-gray-light font-display">pt</span>
                </div>
              </div>

              <p className="text-xs text-hatofes-gray text-right">リアルタイム同期中</p>
            </section>
          </Link>

          {/* Login Bonus */}
          {loginBonusAvailable && (
            <section className="card border border-hatofes-accent-yellow/40 bg-gradient-to-r from-hatofes-accent-yellow/10 to-transparent">
              <button
                onClick={handleClaimLoginBonus}
                disabled={claimingBonus}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎁</span>
                  <div className="text-left">
                    <p className="text-hatofes-white font-bold text-sm">今日のログインボーナス</p>
                    <p className="text-xs text-hatofes-gray">{claimingBonus ? '受け取り中...' : '1日1回のボーナスを受け取る'}</p>
                  </div>
                </div>
                <span className="point-badge">10pt＋🎫</span>
              </button>
            </section>
          )}

          {/* Notifications */}
          <section className="card">
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
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {!item.isRead && (
                          <span className="w-2 h-2 bg-hatofes-accent-orange rounded-full flex-shrink-0" />
                        )}
                        <span className={`text-sm truncate ${item.isRead ? 'text-hatofes-gray' : 'text-hatofes-white font-bold'}`}>
                          {item.title}
                        </span>
                      </div>
                      <ChevronRightIcon />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Link to="/notifications" className="block mt-4">
              <div className="btn-sub w-full py-2 text-center text-sm">
                もっと見る
              </div>
            </Link>
          </section>

          {/* Tasks Section */}
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-400 rounded-full"></span>
                <h2 className="font-bold text-hatofes-white">Task</h2>
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
              <div className="btn-sub w-full py-2 text-center text-sm">
                もっと見る
              </div>
            </Link>
          </section>

          {/* Missions Section */}
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-purple-400 rounded-full"></span>
                <h2 className="font-bold text-hatofes-white">Mission</h2>
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
              <div className="btn-sub w-full py-2 text-center text-sm">
                もっと見る
              </div>
            </Link>
          </section>

          {/* Gacha Banner */}
          <Link to="/gacha" className="block">
            <section className="card bg-gradient-to-r from-hatofes-accent-yellow/10 to-hatofes-accent-orange/10 border border-hatofes-accent-yellow/40 hover:border-hatofes-accent-yellow/70 transition-all">
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

          {/* Recent Points */}
          <section className="card">
            <h2 className="font-bold mb-4 text-hatofes-white">最近のポイント履歴</h2>
            {historyLoading ? (
              <div className="flex justify-center py-4"><Spinner size="md" /></div>
            ) : history.length === 0 ? (
              <p className="text-sm text-hatofes-gray text-center py-4">まだポイント履歴がありません</p>
            ) : (
              <ul className="space-y-2">
                {history.slice(0, 3).map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 border-b border-hatofes-gray last:border-0">
                    <div>
                      <p className="text-sm text-hatofes-white">{getReasonLabel(item.reason)}</p>
                      <p className="text-xs text-hatofes-gray font-display">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <span className="text-gradient font-bold">+{item.points}pt</span>
                  </li>
                ))}
              </ul>
            )}

            <Link to="/point" className="block mt-4">
              <div className="btn-sub w-full py-2 text-center text-sm">
                もっと見る
              </div>
            </Link>
          </section>

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

function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    login_bonus: 'ログインボーナス',
    survey: 'アンケート回答',
    admin_grant: '運営からの付与',
    game_result: 'ゲーム結果',
  }
  return labels[reason] || reason
}

function formatDate(timestamp: { seconds: number; nanoseconds: number }): string {
  const date = new Date(timestamp.seconds * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'たった今'
  if (diffMins < 60) return `${diffMins}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 7) return `${diffDays}日前`

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}
