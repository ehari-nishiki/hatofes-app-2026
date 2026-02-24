import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy, limit, doc, getDoc, writeBatch, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '@/lib/firebase'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from 'recharts'

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

const resetTetrisRankingsFn = httpsCallable<void, {
  success: boolean;
  message: string;
  deletedCount: number;
}>(fns, 'resetTetrisRankings')

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

  // Tetris ranking reset
  const [tetrisResetLoading, setTetrisResetLoading] = useState(false)
  const [tetrisResetMessage, setTetrisResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Executive access config
  const [executiveUserIds, setExecutiveUserIds] = useState<string[]>([])
  const [executiveNames, setExecutiveNames] = useState<string[]>([])
  const [newExecutiveId, setNewExecutiveId] = useState('')
  const [newExecutiveName, setNewExecutiveName] = useState('')
  const [executiveSaving, setExecutiveSaving] = useState(false)

  // Feature toggles
  const [featureToggles, setFeatureToggles] = useState({
    boothsEnabled: false,
    eventsEnabled: false,
    radioEnabled: false,
    executiveQAEnabled: false,
  })
  const [featureTogglesSaving, setFeatureTogglesSaving] = useState(false)

  // Festival date config
  const [festivalStartDate, setFestivalStartDate] = useState('')
  const [festivalEndDate, setFestivalEndDate] = useState('')
  const [festivalMessage, setFestivalMessage] = useState('')
  const [countdownEnabled, setCountdownEnabled] = useState(false)
  const [festivalUpdating, setFestivalUpdating] = useState(false)
  const [festivalMessage2, setFestivalMessage2] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

        // Fetch festival date config
        const festivalDoc = await getDoc(doc(db, 'config', 'festivalDate'))
        if (festivalDoc.exists()) {
          const festivalData = festivalDoc.data()
          if (festivalData.startDate) {
            const start = festivalData.startDate.toDate()
            setFestivalStartDate(start.toISOString().slice(0, 16))
          }
          if (festivalData.endDate) {
            const end = festivalData.endDate.toDate()
            setFestivalEndDate(end.toISOString().slice(0, 16))
          }
          setFestivalMessage(festivalData.message || '')
          setCountdownEnabled(festivalData.countdownEnabled ?? false)
        }

        // Fetch feature toggles
        const featureDoc = await getDoc(doc(db, 'config', 'featureToggles'))
        if (featureDoc.exists()) {
          const featureData = featureDoc.data()
          setFeatureToggles({
            boothsEnabled: featureData.boothsEnabled ?? false,
            eventsEnabled: featureData.eventsEnabled ?? false,
            radioEnabled: featureData.radioEnabled ?? false,
            executiveQAEnabled: featureData.executiveQAEnabled ?? false,
          })
        }

        // Fetch executive access config
        const execDoc = await getDoc(doc(db, 'config', 'executiveAccess'))
        if (execDoc.exists()) {
          const execData = execDoc.data()
          setExecutiveUserIds(execData.executiveUserIds || [])
          setExecutiveNames(execData.executiveNames || [])
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
    { to: '/admin/booths', label: 'ブース管理', icon: '🏪', desc: '出展ブースの登録・管理' },
    { to: '/admin/events', label: 'イベント管理', icon: '📅', desc: 'スケジュールの登録・管理' },
    { to: '/admin/radio', label: '鳩ラジ管理', icon: '📻', desc: 'ラジオ配信・リクエスト管理' },
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

  // Reset tetris rankings
  const handleResetTetrisRankings = async () => {
    if (!confirm('本当にテトリスランキングを全てリセットしますか？この操作は取り消せません。')) return

    setTetrisResetLoading(true)
    setTetrisResetMessage(null)
    try {
      const result = await resetTetrisRankingsFn()
      setTetrisResetMessage({ type: 'success', text: result.data.message })
    } catch (error) {
      console.error('Error resetting tetris rankings:', error)
      setTetrisResetMessage({ type: 'error', text: 'リセットに失敗しました: ' + (error as Error).message })
    } finally {
      setTetrisResetLoading(false)
    }
  }

  // Update feature toggles
  const handleUpdateFeatureToggles = async () => {
    setFeatureTogglesSaving(true)
    try {
      await setDoc(doc(db, 'config', 'featureToggles'), featureToggles)
      alert('機能設定を保存しました')
    } catch (error) {
      console.error('Error updating feature toggles:', error)
      alert('保存に失敗しました')
    } finally {
      setFeatureTogglesSaving(false)
    }
  }

  // Add executive
  const handleAddExecutive = () => {
    if (!newExecutiveId.trim() || !newExecutiveName.trim()) {
      alert('ユーザーIDと名前を入力してください')
      return
    }
    if (executiveUserIds.includes(newExecutiveId.trim())) {
      alert('このユーザーIDは既に登録されています')
      return
    }
    setExecutiveUserIds([...executiveUserIds, newExecutiveId.trim()])
    setExecutiveNames([...executiveNames, newExecutiveName.trim()])
    setNewExecutiveId('')
    setNewExecutiveName('')
  }

  // Remove executive
  const handleRemoveExecutive = (index: number) => {
    setExecutiveUserIds(executiveUserIds.filter((_, i) => i !== index))
    setExecutiveNames(executiveNames.filter((_, i) => i !== index))
  }

  // Save executive access config
  const handleSaveExecutiveAccess = async () => {
    setExecutiveSaving(true)
    try {
      await setDoc(doc(db, 'config', 'executiveAccess'), {
        executiveUserIds,
        executiveNames,
        lastUpdated: Timestamp.now(),
      }, { merge: true })
      alert('三役設定を保存しました')
    } catch (error) {
      console.error('Error saving executive access:', error)
      alert('保存に失敗しました')
    } finally {
      setExecutiveSaving(false)
    }
  }

  // Update festival date config
  const handleUpdateFestivalDate = async () => {
    if (!festivalStartDate || !festivalEndDate) {
      setFestivalMessage2({ type: 'error', text: '開始日時と終了日時を入力してください' })
      return
    }

    const startDate = new Date(festivalStartDate)
    const endDate = new Date(festivalEndDate)

    if (startDate >= endDate) {
      setFestivalMessage2({ type: 'error', text: '終了日時は開始日時より後にしてください' })
      return
    }

    setFestivalUpdating(true)
    setFestivalMessage2(null)
    try {
      await setDoc(doc(db, 'config', 'festivalDate'), {
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        countdownEnabled,
        message: festivalMessage || null,
      })
      setFestivalMessage2({ type: 'success', text: '鳩祭日程を更新しました' })
    } catch (error) {
      console.error('Error updating festival date:', error)
      setFestivalMessage2({ type: 'error', text: '更新に失敗しました' })
    } finally {
      setFestivalUpdating(false)
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

        {/* Festival Date Config (admin only) */}
        {userData?.role === 'admin' && (
          <div className="card mb-8 border-2 border-purple-500/30">
            <h2 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
              <span>🎉</span> 鳩祭日程設定
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-hatofes-gray mb-2">開始日時</label>
                <input
                  type="datetime-local"
                  value={festivalStartDate}
                  onChange={e => setFestivalStartDate(e.target.value)}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                />
              </div>
              <div>
                <label className="block text-sm text-hatofes-gray mb-2">終了日時</label>
                <input
                  type="datetime-local"
                  value={festivalEndDate}
                  onChange={e => setFestivalEndDate(e.target.value)}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-hatofes-gray mb-2">カスタムメッセージ（任意）</label>
              <input
                type="text"
                value={festivalMessage}
                onChange={e => setFestivalMessage(e.target.value)}
                placeholder="例: 今年も熱い2日間になるぞ!"
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={countdownEnabled}
                  onChange={e => setCountdownEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-hatofes-gray bg-hatofes-dark text-hatofes-accent-yellow focus:ring-hatofes-accent-yellow"
                />
                <span className="text-hatofes-white text-sm">カウントダウンを表示する</span>
              </label>
            </div>
            {festivalMessage2 && (
              <div className={`mb-3 p-3 rounded-lg text-sm ${festivalMessage2.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {festivalMessage2.text}
              </div>
            )}
            <button
              onClick={handleUpdateFestivalDate}
              disabled={festivalUpdating}
              className="btn-main w-full py-2 disabled:opacity-50"
            >
              {festivalUpdating ? '更新中...' : '日程を保存'}
            </button>
          </div>
        )}

        {/* Feature Toggles (admin only) */}
        {userData?.role === 'admin' && (
          <div className="card mb-8 border-2 border-cyan-500/30">
            <h2 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
              <span>🎚️</span> 機能ON/OFF設定
            </h2>
            <p className="text-xs text-hatofes-gray mb-4">
              文化祭当日まで非表示にしておきたい機能を管理します
            </p>
            <div className="space-y-3 mb-4">
              <label className="flex items-center justify-between p-3 bg-hatofes-dark rounded-lg cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏪</span>
                  <span className="text-hatofes-white text-sm">ブース一覧</span>
                </div>
                <input
                  type="checkbox"
                  checked={featureToggles.boothsEnabled}
                  onChange={e => setFeatureToggles({ ...featureToggles, boothsEnabled: e.target.checked })}
                  className="w-5 h-5 rounded border-hatofes-gray bg-hatofes-dark text-cyan-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-hatofes-dark rounded-lg cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📅</span>
                  <span className="text-hatofes-white text-sm">イベントスケジュール</span>
                </div>
                <input
                  type="checkbox"
                  checked={featureToggles.eventsEnabled}
                  onChange={e => setFeatureToggles({ ...featureToggles, eventsEnabled: e.target.checked })}
                  className="w-5 h-5 rounded border-hatofes-gray bg-hatofes-dark text-cyan-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-hatofes-dark rounded-lg cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📻</span>
                  <span className="text-hatofes-white text-sm">鳩ラジ</span>
                </div>
                <input
                  type="checkbox"
                  checked={featureToggles.radioEnabled}
                  onChange={e => setFeatureToggles({ ...featureToggles, radioEnabled: e.target.checked })}
                  className="w-5 h-5 rounded border-hatofes-gray bg-hatofes-dark text-cyan-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-hatofes-dark rounded-lg cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-xl">👑</span>
                  <span className="text-hatofes-white text-sm">三役Q&Aコーナー</span>
                </div>
                <input
                  type="checkbox"
                  checked={featureToggles.executiveQAEnabled}
                  onChange={e => setFeatureToggles({ ...featureToggles, executiveQAEnabled: e.target.checked })}
                  className="w-5 h-5 rounded border-hatofes-gray bg-hatofes-dark text-cyan-500"
                />
              </label>
            </div>
            <button
              onClick={handleUpdateFeatureToggles}
              disabled={featureTogglesSaving}
              className="btn-main w-full py-2 disabled:opacity-50"
            >
              {featureTogglesSaving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        )}

        {/* Executive Access Config (admin only) */}
        {userData?.role === 'admin' && (
          <div className="card mb-8 border-2 border-purple-500/30">
            <h2 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
              <span>👑</span> 三役Q&A設定
            </h2>
            <p className="text-xs text-hatofes-gray mb-4">
              三役Q&Aコーナーで回答できるユーザーを設定します（実行委員長1名＋副委員長2名）
            </p>

            {/* Current executives */}
            <div className="space-y-2 mb-4">
              {executiveUserIds.map((id, index) => (
                <div key={id} className="flex items-center justify-between p-3 bg-hatofes-dark rounded-lg">
                  <div>
                    <p className="text-hatofes-white text-sm font-medium">{executiveNames[index] || '名前未設定'}</p>
                    <p className="text-xs text-hatofes-gray">ID: {id}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveExecutive(index)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    削除
                  </button>
                </div>
              ))}
              {executiveUserIds.length === 0 && (
                <p className="text-hatofes-gray text-sm text-center py-4">まだ三役が設定されていません</p>
              )}
            </div>

            {/* Add new executive */}
            <div className="border-t border-hatofes-gray pt-4">
              <p className="text-sm text-hatofes-white mb-2">三役を追加</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={newExecutiveId}
                  onChange={e => setNewExecutiveId(e.target.value)}
                  placeholder="ユーザーID（UIDをコピペ）"
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white text-sm"
                />
                <input
                  type="text"
                  value={newExecutiveName}
                  onChange={e => setNewExecutiveName(e.target.value)}
                  placeholder="表示名（例: 委員長 山田太郎）"
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAddExecutive}
                  disabled={!newExecutiveId.trim() || !newExecutiveName.trim()}
                  className="btn-sub py-2 px-4 text-sm disabled:opacity-50"
                >
                  追加
                </button>
                <button
                  onClick={handleSaveExecutiveAccess}
                  disabled={executiveSaving}
                  className="btn-main py-2 px-4 text-sm disabled:opacity-50"
                >
                  {executiveSaving ? '保存中...' : '設定を保存'}
                </button>
              </div>
            </div>
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

        {/* System Management (admin only) */}
        {userData?.role === 'admin' && (
          <div className="card mb-8 border-2 border-orange-500/30">
            <h2 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
              <span>⚙️</span> システム管理
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-hatofes-white mb-2">テトリスランキング</h3>
                <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <p className="text-sm text-orange-400">
                    ⚠️ 全てのテトリスランキングをリセットします。この操作は取り消せません。
                  </p>
                </div>
                <button
                  onClick={handleResetTetrisRankings}
                  disabled={tetrisResetLoading}
                  className="btn-main py-2 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                >
                  {tetrisResetLoading ? 'リセット中...' : '🧱 テトリスランキングをリセット'}
                </button>
                {tetrisResetMessage && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    tetrisResetMessage.type === 'success'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    <p className="text-sm">{tetrisResetMessage.text}</p>
                  </div>
                )}
              </div>
            </div>
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

        {/* Charts Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ポイント理由別内訳（円グラフ） */}
          <div className="card">
            <h2 className="text-lg font-bold text-hatofes-white mb-4 flex items-center gap-2">
              <span>🥧</span> ポイント理由別内訳
            </h2>
            {Object.keys(pointStats.byReason).length === 0 ? (
              <p className="text-hatofes-gray text-center py-8">データがありません</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={Object.entries(pointStats.byReason)
                      .filter(([, data]) => data.total > 0)
                      .map(([reason, data]) => {
                        const reasonLabels: Record<string, string> = {
                          login_bonus: 'ログイン',
                          survey: 'アンケート',
                          admin_grant: '管理者付与',
                          game_result: 'ゲーム',
                        }
                        return {
                          name: reasonLabels[reason] || reason,
                          value: data.total,
                        }
                      })}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {Object.entries(pointStats.byReason)
                      .filter(([, data]) => data.total > 0)
                      .map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={['#FFD700', '#00d4ff', '#ff9f43', '#39d353', '#bf5fff', '#ff4757'][index % 6]}
                        />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString()} pt`, 'ポイント']}
                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* クラス別ポイント比較（棒グラフ） */}
          <div className="card">
            <h2 className="text-lg font-bold text-hatofes-white mb-4 flex items-center gap-2">
              <span>📊</span> クラス別ポイント比較
            </h2>
            {topClasses.length === 0 ? (
              <p className="text-hatofes-gray text-center py-8">データがありません</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={topClasses.map(cls => ({
                    name: cls.id,
                    points: cls.totalPoints,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <XAxis type="number" tickFormatter={(value: number) => value.toLocaleString()} stroke="#666" />
                  <YAxis type="category" dataKey="name" stroke="#666" width={50} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString()} pt`, 'ポイント']}
                    contentStyle={{ backgroundColor: '#1a1a2a', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Bar
                    dataKey="points"
                    name="クラスポイント"
                    fill="url(#colorGradient)"
                    radius={[0, 4, 4, 0]}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#FFD700" />
                      <stop offset="100%" stopColor="#ff9f43" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
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
