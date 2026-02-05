import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { getSurveysByCategory } from '@/lib/surveyService'
import type { Survey } from '@/types/firestore'

type SurveyWithStatus = Survey & { id: string; isAnswered: boolean }

export default function TasksPage() {
  const { currentUser, userData } = useAuth()
  const [tasks, setTasks] = useState<SurveyWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTasks = async () => {
      if (!currentUser) return

      try {
        const data = await getSurveysByCategory('task', currentUser.uid)
        setTasks(data)
      } catch (error) {
        console.error('Error fetching tasks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [currentUser])

  const availableTasks = tasks.filter(t => !t.isAnswered)
  const completedTasks = tasks.filter(t => t.isAnswered)

  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-hatofes-white">Task</h1>
            <p className="text-xs text-hatofes-gray mt-1">全員対象のタスクです</p>
          </div>
          {availableTasks.length > 0 && (
            <span className="notification-badge">{availableTasks.length}</span>
          )}
        </div>

        {loading ? (
          <div className="card">
            <p className="text-hatofes-gray text-center py-4">読み込み中...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="card">
            <p className="text-hatofes-gray text-center py-4">現在タスクはありません</p>
          </div>
        ) : (
          <>
            {/* Available Tasks */}
            {availableTasks.length > 0 && (
              <div className="card mb-6">
                <h2 className="text-sm font-bold text-hatofes-gray-light mb-4">未完了のタスク</h2>
                <ul className="divide-y divide-hatofes-gray">
                  {availableTasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        to={`/tasks/${task.id}`}
                        className="flex items-center justify-between py-4 hover:bg-hatofes-dark transition-colors -mx-4 px-4"
                      >
                        <div className="flex-1">
                          <p className="text-hatofes-white text-sm">{task.title}</p>
                          {task.description && (
                            <p className="text-hatofes-gray text-xs mt-1 line-clamp-1">{task.description}</p>
                          )}
                        </div>
                        <span className="point-badge">{task.points}pt</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="card">
                <h2 className="text-sm font-bold text-hatofes-gray-light mb-4">完了済み</h2>
                <ul className="divide-y divide-hatofes-gray">
                  {completedTasks.map((task) => (
                    <li key={task.id} className="py-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-hatofes-white text-sm line-through">{task.title}</p>
                        </div>
                        <span className="text-hatofes-gray text-sm">+{task.points}pt</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

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
