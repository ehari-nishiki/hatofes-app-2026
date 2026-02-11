import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy, limit, doc, getDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '@/lib/firebase'

const fns = getFunctions(app)
const updateLoginBonusConfigFn = httpsCallable<
  { points: number; tickets: number },
  { success: boolean; message: string }
>(fns, 'updateLoginBonusConfig')
// refreshDashboardStatsFn is available but not used yet (for future manual refresh feature)
// const refreshDashboardStatsFn = httpsCallable<void, { success: boolean; stats: DashboardStats }>(fns, 'refreshDashboardStats')

// Security audit functions
const auditAndFixAdminRolesFn = httpsCallable<void, {
  success: boolean;
  message: string;
  fixed: string[];
  kept: string[];
}>(fns, 'auditAndFixAdminRoles')

const listPrivilegedUsersFn = httpsCallable<void, {
  success: boolean;
  admins: Array<{ id: string; email: string; username: string; isAllowed: boolean }>;
  staff: Array<{ id: string; email: string; username: string }>;
  allowedAdminEmails: string[];
}>(fns, 'listPrivilegedUsers')

interface DashboardStats {
  totalUsers: number
  totalStudents: number
  totalTeachers: number
  totalStaff: number
  totalAdmins: number
  todayLogins: number
  totalPointsIssued: number
  activeSurveys: number
  lastUpdated?: { seconds: number }
}

interface Stats {
  totalUsers: number
  totalPoints: number
  activeUsers: number
  totalSurveys: number
}

interface TopClass {
  id: string
  grade: number
  className: string
  totalPoints: number
}

interface FeedbackDoc {
  id: string
  userId: string
  username: string
  message: string
  createdAt: { seconds: number } | Date
}

export default function AdminDashboard() {
  const { userData } = useAuth()
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalPoints: 0, activeUsers: 0, totalSurveys: 0 })
  const [topClasses, setTopClasses] = useState<TopClass[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [recalculatingPoints, setRecalculatingPoints] = useState(false)

  // Login bonus config
  const [loginBonusPoints, setLoginBonusPoints] = useState(10)
  const [loginBonusTickets, setLoginBonusTickets] = useState(1)
  const [bonusUpdating, setBonusUpdating] = useState(false)
  const [bonusMessage, setBonusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Point statistics
  const [pointStats, setPointStats] = useState<{
    byReason: Record<string, { count: number; total: number }>
    topUsers: Array<{ id: string; username: string; points: number }>
  }>({
    byReason: {},
    topUsers: [],
  })

  // Security audit
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditResult, setAuditResult] = useState<{ fixed: string[]; kept: string[] } | null>(null)
  const [privilegedUsers, setPrivilegedUsers] = useState<{
    admins: Array<{ id: string; email: string; username: string; isAllowed: boolean }>;
    staff: Array<{ id: string; email: string; username: string }>;
  } | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use cached dashboard stats (99% read reduction)
        const dashboardStatsDoc = await getDoc(doc(db, 'config', 'dashboardStats'))
        if (dashboardStatsDoc.exists()) {
          const cachedStats = dashboardStatsDoc.data() as DashboardStats
          setStats({
            totalUsers: cachedStats.totalUsers,
            totalPoints: cachedStats.totalPointsIssued,
            activeUsers: cachedStats.todayLogins,
            totalSurveys: cachedStats.activeSurveys,
          })
        } else {
          // Fallback: calculate if cache doesn't exist yet
          const usersSnap = await getDocs(collection(db, 'users'))
          let totalPoints = 0
          let activeUsers = 0
          const today = new Date().toISOString().split('T')[0]

          usersSnap.forEach(doc => {
            const data = doc.data()
            totalPoints += data.totalPoints || 0
            if (data.lastLoginDate === today) activeUsers++
          })

          const surveysSnap = await getDocs(collection(db, 'surveys'))

          setStats({
            totalUsers: usersSnap.size,
            totalPoints,
            activeUsers,
            totalSurveys: surveysSnap.size,
          })
        }

        // Fetch top classes
        const classesQuery = query(collection(db, 'classes'), orderBy('totalPoints', 'desc'), limit(5))
        const classesSnap = await getDocs(classesQuery)
        const classes: TopClass[] = []
        classesSnap.forEach(doc => {
          classes.push({ id: doc.id, ...doc.data() } as TopClass)
        })

        // Fetch recent feedbacks
        const feedbackQuery = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'), limit(20))
        const feedbackSnap = await getDocs(feedbackQuery)
        const fbList: FeedbackDoc[] = []
        feedbackSnap.forEach(docSnap => {
          fbList.push({ id: docSnap.id, ...docSnap.data() } as FeedbackDoc)
        })

        // Fetch login bonus config
        const bonusDoc = await getDoc(doc(db, 'config', 'loginBonus'))
        if (bonusDoc.exists()) {
          const bonusData = bonusDoc.data()
          setLoginBonusPoints(bonusData.points ?? 10)
          setLoginBonusTickets(bonusData.tickets ?? 1)
        }

        // Fetch point statistics from aggregate document (or calculate from limited sample)
        let reasonStats: Record<string, { count: number; total: number }> = {}

        // Try to get cached stats first
        const statsDoc = await getDoc(doc(db, 'config', 'pointStats'))
        if (statsDoc.exists()) {
          reasonStats = statsDoc.data().byReason || {}
        } else {
          // Fallback: sample recent 500 records for stats (not full history)
          const pointHistoryQuery = query(
            collection(db, 'pointHistory'),
            orderBy('createdAt', 'desc'),
            limit(500)
          )
          const pointHistorySnap = await getDocs(pointHistoryQuery)

          pointHistorySnap.forEach(docSnap => {
            const data = docSnap.data()
            const reason = data.reason || 'unknown'
            const points = data.points || 0

            if (!reasonStats[reason]) {
              reasonStats[reason] = { count: 0, total: 0 }
            }
            reasonStats[reason].count += 1
            reasonStats[reason].total += points
          })
        }

        // Get top users by points
        const usersQuery = query(collection(db, 'users'), orderBy('totalPoints', 'desc'), limit(10))
        const topUsersSnap = await getDocs(usersQuery)
        const topUsersList: Array<{ id: string; username: string; points: number }> = []
        topUsersSnap.forEach(docSnap => {
          const data = docSnap.data()
          topUsersList.push({
            id: docSnap.id,
            username: data.username,
            points: data.totalPoints || 0,
          })
        })

        setPointStats({
          byReason: reasonStats,
          topUsers: topUsersList,
        })

        setTopClasses(classes)
        setFeedbacks(fbList)
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const menuItems = [
    { to: '/admin/points', label: 'ポイント付与', icon: '💰', desc: 'ユーザーにポイントを付与' },
    { to: '/admin/surveys', label: 'アンケート管理', icon: '📋', desc: 'アンケートの作成・管理' },
    { to: '/admin/notifications', label: '通知送信', icon: '🔔', desc: 'ユーザーへの通知を送信' },
    { to: '/admin/users', label: 'ユーザー管理', icon: '👥', desc: 'ユーザーの一覧・管理' },
    { to: '/admin/gacha', label: 'ガチャ管理', icon: '🎰', desc: 'アイテム・チケット配布' },
  ]

  // Update login bonus config
  const handleUpdateLoginBonus = async () => {
    if (loginBonusPoints < 0 || loginBonusTickets < 0) {
      setBonusMessage({ type: 'error', text: '値は0以上である必要があります' })
      return
    }

    setBonusUpdating(true)
    setBonusMessage(null)
    try {
      await updateLoginBonusConfigFn({ points: loginBonusPoints, tickets: loginBonusTickets })
      setBonusMessage({ type: 'success', text: 'ログインボーナス設定を更新しました' })
    } catch (error) {
      console.error('Error updating login bonus:', error)
      setBonusMessage({ type: 'error', text: '更新に失敗しました' })
    } finally {
      setBonusUpdating(false)
    }
  }

  // Security audit: Check current privileged users
  const handleListPrivilegedUsers = async () => {
    setAuditLoading(true)
    try {
      const result = await listPrivilegedUsersFn()
      setPrivilegedUsers({
        admins: result.data.admins,
        staff: result.data.staff,
      })
    } catch (error) {
      console.error('Error listing privileged users:', error)
      alert('権限ユーザーの取得に失敗しました')
    } finally {
      setAuditLoading(false)
    }
  }

  // Security audit: Fix unauthorized admins
  const handleAuditAndFix = async () => {
    if (!confirm('不正なadminユーザーを自動でstudentに降格します。実行しますか？')) return

    setAuditLoading(true)
    try {
      const result = await auditAndFixAdminRolesFn()
      setAuditResult({
        fixed: result.data.fixed,
        kept: result.data.kept,
      })
      alert(result.data.message)
      // Refresh the list
      await handleListPrivilegedUsers()
    } catch (error) {
      console.error('Error auditing admin roles:', error)
      alert('監査に失敗しました: ' + (error as Error).message)
    } finally {
      setAuditLoading(false)
    }
  }

  // Recalculate total points from user data
  const handleRecalculateTotalPoints = async () => {
    setRecalculatingPoints(true)
    try {
      // Get all users and sum their totalPoints
      const usersSnap = await getDocs(collection(db, 'users'))
      let totalPoints = 0

      usersSnap.forEach(docSnap => {
        const data = docSnap.data()
        totalPoints += data.totalPoints || 0
      })

      // Update stats
      setStats(prev => ({ ...prev, totalPoints }))
      alert(`総ポイント数を再計算しました: ${totalPoints.toLocaleString()} pt`)
    } catch (error) {
      console.error('Error recalculating total points:', error)
      alert('再計算に失敗しました')
    } finally {
      setRecalculatingPoints(false)
    }
  }

  // Recalculate class points from user data
  const handleRecalculateClassPoints = async () => {
    if (!confirm('クラスポイントをユーザーデータから再計算しますか？')) return

    setRecalculating(true)
    try {
      // Get all users
      const usersSnap = await getDocs(collection(db, 'users'))

      // Calculate class totals
      const classData: Record<string, { grade: number; className: string; totalPoints: number; memberCount: number }> = {}

      usersSnap.forEach(docSnap => {
        const data = docSnap.data()
        if (data.grade && data.class) {
          const classId = `${data.grade}-${data.class}`
          if (!classData[classId]) {
            classData[classId] = {
              grade: data.grade,
              className: data.class,
              totalPoints: 0,
              memberCount: 0,
            }
          }
          classData[classId].totalPoints += data.totalPoints || 0
          classData[classId].memberCount += 1
        }
      })

      // Delete all existing class documents using batch
      const existingClassesSnap = await getDocs(collection(db, 'classes'))
      const deleteBatch = writeBatch(db)
      existingClassesSnap.docs.forEach(docSnap => {
        deleteBatch.delete(doc(db, 'classes', docSnap.id))
      })
      await deleteBatch.commit()

      // Create new class documents using batch
      const createBatch = writeBatch(db)
      for (const [classId, data] of Object.entries(classData)) {
        createBatch.set(doc(db, 'classes', classId), data)
      }
      await createBatch.commit()

      // Refresh the page data
      const classesQuery = query(collection(db, 'classes'), orderBy('totalPoints', 'desc'), limit(5))
      const classesSnap = await getDocs(classesQuery)
      const classes: TopClass[] = []
      classesSnap.forEach(docSnap => {
        classes.push({ id: docSnap.id, ...docSnap.data() } as TopClass)
      })
      setTopClasses(classes)

      alert('クラスポイントを再計算しました')
    } catch (error) {
      console.error('Error recalculating class points:', error)
      alert('再計算に失敗しました')
    } finally {
      setRecalculating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hatofes-bg">
      {/* Header */}
      <header className="bg-hatofes-dark border-b border-hatofes-gray-lighter px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-hatofes-white">管理パネル</h1>
            <p className="text-sm text-hatofes-gray">{userData?.username} ({userData?.role})</p>
          </div>
          <Link to="/home" className="btn-sub text-sm px-4 py-2">
            ユーザー画面へ
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-3xl font-bold text-gradient font-display">{stats.totalUsers}</p>
            <p className="text-sm text-hatofes-gray mt-1">総ユーザー数</p>
          </div>
          <div className="card text-center relative">
            <p className="text-3xl font-bold text-gradient font-display">{stats.totalPoints.toLocaleString()}</p>
            <p className="text-sm text-hatofes-gray mt-1">総ポイント数</p>
            <button
              onClick={handleRecalculateTotalPoints}
              disabled={recalculatingPoints}
              className="absolute top-2 right-2 text-xs text-hatofes-gray hover:text-hatofes-white disabled:opacity-50 bg-hatofes-dark px-2 py-1 rounded"
              title="ユーザーデータから再計算"
            >
              {recalculatingPoints ? '...' : '🔄'}
            </button>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-gradient font-display">{stats.activeUsers}</p>
            <p className="text-sm text-hatofes-gray mt-1">本日のアクティブ</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-gradient font-display">{stats.totalSurveys}</p>
            <p className="text-sm text-hatofes-gray mt-1">アンケート数</p>
          </div>
        </div>

        {/* Login Bonus Config (admin only) */}
        {userData?.role === 'admin' && (
          <div className="card mb-8">
            <h2 className="text-lg font-bold text-hatofes-white mb-4 flex items-center gap-2">
              <span>🎁</span> ログインボーナス設定
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-hatofes-gray mb-2">付与ポイント</label>
                <input
                  type="number"
                  value={loginBonusPoints}
                  onChange={e => setLoginBonusPoints(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                />
              </div>
              <div>
                <label className="block text-sm text-hatofes-gray mb-2">付与チケット</label>
                <input
                  type="number"
                  value={loginBonusTickets}
                  onChange={e => setLoginBonusTickets(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                />
              </div>
            </div>
            {bonusMessage && (
              <div className={`mb-3 p-3 rounded-lg text-sm ${bonusMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {bonusMessage.text}
              </div>
            )}
            <button
              onClick={handleUpdateLoginBonus}
              disabled={bonusUpdating}
              className="btn-main w-full py-2 disabled:opacity-50"
            >
              {bonusUpdating ? '更新中...' : '設定を保存'}
            </button>
          </div>
        )}

        {/* Security Audit (admin only) */}
        {userData?.role === 'admin' && (
          <div className="card mb-8 border-2 border-red-500/30">
            <h2 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
              <span>🔒</span> セキュリティ監査
            </h2>

            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-400">
                ⚠️ 不正なadmin権限を持つユーザーを検出・修正します
              </p>
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={handleListPrivilegedUsers}
                disabled={auditLoading}
                className="btn-sub flex-1 py-2 disabled:opacity-50"
              >
                {auditLoading ? '確認中...' : '権限ユーザー確認'}
              </button>
              <button
                onClick={handleAuditAndFix}
                disabled={auditLoading}
                className="btn-main flex-1 py-2 disabled:opacity-50 bg-red-600 hover:bg-red-700"
              >
                {auditLoading ? '修正中...' : '不正admin修正'}
              </button>
            </div>

            {privilegedUsers && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-hatofes-white mb-2">Admin ユーザー ({privilegedUsers.admins.length})</h3>
                  <div className="space-y-2">
                    {privilegedUsers.admins.map(admin => (
                      <div
                        key={admin.id}
                        className={`p-2 rounded border ${
                          admin.isAllowed
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <p className="text-sm text-hatofes-white">
                          {admin.username} ({admin.email})
                        </p>
                        <p className="text-xs text-hatofes-gray">
                          {admin.isAllowed ? '✅ 許可済み' : '❌ 不正'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-hatofes-white mb-2">Staff ユーザー ({privilegedUsers.staff.length})</h3>
                  <div className="space-y-2">
                    {privilegedUsers.staff.map(staff => (
                      <div key={staff.id} className="p-2 rounded border bg-blue-500/10 border-blue-500/30">
                        <p className="text-sm text-hatofes-white">
                          {staff.username} ({staff.email})
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {auditResult && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-green-400 font-bold mb-2">✅ 修正完了</p>
                <p className="text-xs text-hatofes-gray">
                  修正: {auditResult.fixed.length}人 / 維持: {auditResult.kept.length}人
                </p>
                {auditResult.fixed.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-hatofes-gray mb-1">修正されたユーザー:</p>
                    <ul className="text-xs text-red-400 space-y-1">
                      {auditResult.fixed.map((email, i) => (
                        <li key={i}>• {email}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <h2 className="text-lg font-bold text-hatofes-white mb-4">クイックアクション</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {menuItems.map(item => (
            <Link key={item.to} to={item.to} className="card hover:ring-1 hover:ring-hatofes-accent-yellow transition-all">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{item.icon}</span>
                <div>
                  <p className="font-bold text-hatofes-white">{item.label}</p>
                  <p className="text-sm text-hatofes-gray">{item.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Class Ranking */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-hatofes-white">クラスランキング TOP5</h2>
          <button
            onClick={handleRecalculateClassPoints}
            disabled={recalculating}
            className="text-xs text-hatofes-gray hover:text-hatofes-white disabled:opacity-50"
          >
            {recalculating ? '再計算中...' : 'データを再計算'}
          </button>
        </div>
        <div className="card">
          {topClasses.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">データがありません</p>
          ) : (
            <div className="space-y-3">
              {topClasses.map((cls, index) => (
                <div key={cls.id} className="flex items-center justify-between py-2 border-b border-hatofes-gray last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-300 text-black' :
                      index === 2 ? 'bg-orange-400 text-black' :
                      'bg-hatofes-gray-lighter text-hatofes-white'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-hatofes-white font-medium">{cls.id}</span>
                  </div>
                  <span className="text-gradient font-bold">{cls.totalPoints.toLocaleString()} pt</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Point Statistics */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By Reason */}
          <div className="card">
            <h2 className="text-lg font-bold text-hatofes-white mb-4">理由別ポイント統計</h2>
            {Object.keys(pointStats.byReason).length === 0 ? (
              <p className="text-hatofes-gray text-center py-4">データがありません</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(pointStats.byReason)
                  .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
                  .map(([reason, data]) => {
                    const reasonLabels: Record<string, string> = {
                      login_bonus: 'ログインボーナス',
                      survey: 'アンケート',
                      admin_grant: '管理者付与',
                      admin_deduct: '管理者剥奪',
                      admin_clear: 'ポイントクリア',
                      game_result: 'ゲーム結果',
                    }
                    return (
                      <div key={reason} className="bg-hatofes-dark p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-hatofes-white text-sm font-medium">
                            {reasonLabels[reason] || reason}
                          </span>
                          <span className={`font-bold font-display text-sm ${data.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {data.total >= 0 ? '+' : ''}{data.total.toLocaleString()}pt
                          </span>
                        </div>
                        <p className="text-xs text-hatofes-gray">{data.count.toLocaleString()} 件</p>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Top Users */}
          <div className="card">
            <h2 className="text-lg font-bold text-hatofes-white mb-4">トップユーザー</h2>
            {pointStats.topUsers.length === 0 ? (
              <p className="text-hatofes-gray text-center py-4">データがありません</p>
            ) : (
              <div className="space-y-2">
                {pointStats.topUsers.map((user, index) => (
                  <div key={user.id} className="flex items-center justify-between py-2 border-b border-hatofes-gray last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-300 text-black' :
                        index === 2 ? 'bg-orange-400 text-black' :
                        'bg-hatofes-gray-lighter text-hatofes-white'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-hatofes-white text-sm">{user.username}</span>
                    </div>
                    <span className="text-gradient font-bold text-sm">{user.points.toLocaleString()} pt</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Feedback Section */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">運営への要望</h2>
          <div className="card">
            {feedbacks.length === 0 ? (
              <p className="text-hatofes-gray text-center py-4">要望はありません</p>
            ) : (
              <div className="space-y-3">
                {feedbacks.map(fb => {
                  const date = fb.createdAt && 'seconds' in fb.createdAt
                    ? new Date(fb.createdAt.seconds * 1000)
                    : fb.createdAt instanceof Date ? fb.createdAt : null
                  return (
                    <div key={fb.id} className="bg-hatofes-dark p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-hatofes-white font-medium text-sm">{fb.username}</span>
                        {date && <span className="text-hatofes-gray/50 text-xs">{date.toLocaleString('ja-JP')}</span>}
                      </div>
                      <p className="text-hatofes-gray-light text-sm leading-relaxed">{fb.message}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
