import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getSurveysByCategory } from '@/lib/surveyService'
import type { Survey } from '@/types/firestore'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

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

  if (!userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <div className="text-white">読み込み中...</div>
      </div>
    )
  }

  const availableTasks = tasks.filter((task) => !task.isAnswered)
  const completedTasks = tasks.filter((task) => task.isAnswered)

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      <PageHero
        eyebrow="Task Hub"
        title="Task"
        description="全員対象のタスクを確認して、未完了のものから順番に進められます。"
        badge={availableTasks.length > 0 ? <CountBadge count={availableTasks.length} /> : undefined}
        aside={<PageBackLink />}
      />

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <PageSection>
          <PageSectionTitle eyebrow="Summary" title="進捗" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <PageMetric label="Open" value={availableTasks.length.toString()} />
            <PageMetric label="Done" value={completedTasks.length.toString()} tone="soft" />
          </div>
        </PageSection>

        <div className="space-y-4">
          <PageSection>
            <PageSectionTitle eyebrow="Open Tasks" title="未完了のタスク" />
            {loading ? (
              <PageEmptyState title="タスクを読み込み中です" />
            ) : availableTasks.length === 0 ? (
              <PageEmptyState title="未完了のタスクはありません" description="新しいタスクが出るまでこの状態です。" />
            ) : (
              <div className="space-y-2">
                {availableTasks.map((task) => (
                  <SurveyRow key={task.id} survey={task} href={`/tasks/${task.id}`} />
                ))}
              </div>
            )}
          </PageSection>

          <PageSection>
            <PageSectionTitle eyebrow="Completed" title="完了済み" />
            {loading ? (
              <PageEmptyState title="タスクを読み込み中です" />
            ) : completedTasks.length === 0 ? (
              <PageEmptyState title="完了済みのタスクはまだありません" />
            ) : (
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <SurveyRow key={task.id} survey={task} href={`/tasks/${task.id}`} completed />
                ))}
              </div>
            )}
          </PageSection>
        </div>
      </div>
    </UserPageShell>
  )
}

function SurveyRow({
  survey,
  href,
  completed = false,
}: {
  survey: SurveyWithStatus
  href: string
  completed?: boolean
}) {
  return (
    <Link
      to={href}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1.1rem] px-4 py-4 transition-colors ${
        completed ? 'bg-[#0f1418] opacity-70 hover:opacity-100' : 'bg-white/[0.06] hover:bg-white/[0.085]'
      }`}
    >
      <div className="min-w-0">
        <p className={`truncate text-sm ${completed ? 'text-white/78 line-through' : 'font-medium text-white'}`}>{survey.title}</p>
        {survey.description ? (
          <p className="mt-1 line-clamp-1 text-xs text-white/42">{survey.description}</p>
        ) : null}
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${completed ? 'bg-white/[0.06] text-white/58' : 'bg-[#d9e4dc] text-[#11161a]'}`}>
        +{survey.points}pt
      </span>
    </Link>
  )
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-[#e24d4d] px-3 py-1 text-xs font-semibold text-white">
      {count} open
    </span>
  )
}
