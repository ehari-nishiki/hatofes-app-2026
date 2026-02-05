import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy, limit, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'

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

export default function AdminDashboard() {
  const { userData } = useAuth()
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalPoints: 0, activeUsers: 0, totalSurveys: 0 })
  const [topClasses, setTopClasses] = useState<TopClass[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch users
        const usersSnap = await getDocs(collection(db, 'users'))
        let totalPoints = 0
        let activeUsers = 0
        const today = new Date().toISOString().split('T')[0]

        usersSnap.forEach(doc => {
          const data = doc.data()
          totalPoints += data.totalPoints || 0
          if (data.lastLoginDate === today) activeUsers++
        })

        // Fetch surveys
        const surveysSnap = await getDocs(collection(db, 'surveys'))

        // Fetch top classes
        const classesQuery = query(collection(db, 'classes'), orderBy('totalPoints', 'desc'), limit(5))
        const classesSnap = await getDocs(classesQuery)
        const classes: TopClass[] = []
        classesSnap.forEach(doc => {
          classes.push({ id: doc.id, ...doc.data() } as TopClass)
        })

        setStats({
          totalUsers: usersSnap.size,
          totalPoints,
          activeUsers,
          totalSurveys: surveysSnap.size,
        })
        setTopClasses(classes)
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

      // Delete all existing class documents
      const existingClassesSnap = await getDocs(collection(db, 'classes'))
      for (const docSnap of existingClassesSnap.docs) {
        await deleteDoc(doc(db, 'classes', docSnap.id))
      }

      // Create new class documents
      for (const [classId, data] of Object.entries(classData)) {
        await setDoc(doc(db, 'classes', classId), data)
      }

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
          <div className="card text-center">
            <p className="text-3xl font-bold text-gradient font-display">{stats.totalPoints.toLocaleString()}</p>
            <p className="text-sm text-hatofes-gray mt-1">総ポイント数</p>
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
      </main>
    </div>
  )
}
