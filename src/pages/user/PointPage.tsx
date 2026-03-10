import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { usePointHistory } from '@/hooks/usePointHistory'
import { useClassPoints } from '@/hooks/useClassPoints'
import { generateClassId } from '@/lib/classUtils'
import { AnimatedNumber } from '@/components/ui/PageLoader'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

interface PersonalRankingCacheItem {
  userId: string
}

export default function PointPage() {
  const { currentUser, userData } = useAuth()
  const { history, loading: historyLoading, hasMore, loadMore } = usePointHistory(currentUser?.uid || null)

  const classId = userData?.grade && userData?.class
    ? generateClassId(userData.grade, userData.class)
    : null
  const { classData, loading: classLoading } = useClassPoints(classId)

  const [personalRank, setPersonalRank] = useState<number | null>(null)
  const [totalUsers, setTotalUsers] = useState<number | null>(null)

  useEffect(() => {
    if (!currentUser || !userData) return

    const fetchRank = async () => {
      try {
        const rankingCacheDoc = await getDoc(doc(db, 'config', 'personalRanking'))

        if (!rankingCacheDoc.exists()) return

        const cachedRankings = (rankingCacheDoc.data().rankings || []) as PersonalRankingCacheItem[]
        const rank = cachedRankings.findIndex((item) => item.userId === currentUser.uid) + 1

        setTotalUsers(cachedRankings.length)
        setPersonalRank(rank > 0 ? rank : null)
      } catch (error) {
        console.error('Error fetching rank:', error)
      }
    }

    fetchRank()
  }, [currentUser, userData])

  if (!userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <div className="text-white">読み込み中...</div>
      </div>
    )
  }

  const progressLabel = personalRank !== null && totalUsers
    ? `${personalRank.toLocaleString()} / ${totalUsers.toLocaleString()}`
    : '計算中'

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      <PageHero
        eyebrow="Point Center"
        title="Points"
        description="いまの鳩ポイント、クラス合計、順位、獲得履歴をまとめて確認できます。"
        badge={<LiveSyncBadge />}
        aside={<PageBackLink />}
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <PageSection className="overflow-hidden">
            <PageSectionTitle
              eyebrow="Overview"
              title="現在のポイント"
              meta={<span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/58">個人スコア</span>}
            />

            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.35rem] bg-[#0f1418] p-5 text-white">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">Total Points</p>
                <div className="mt-4 flex items-end gap-2">
                  <span
                    className="text-5xl font-semibold tracking-[-0.06em]"
                    style={{
                      background: 'linear-gradient(135deg, #FFC300, #FF7A18)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    <AnimatedNumber value={userData.totalPoints} duration={1200} />
                  </span>
                  <span className="pb-1 text-sm text-white/52">pt</span>
                </div>
                <p className="mt-4 text-sm text-white/58">毎日のログイン、通知確認、タスク参加がここに反映されます。</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                <PageMetric label="National Rank" value={progressLabel} tone="soft" />
                <PageMetric
                  label="Class Total"
                  value={classLoading ? '...' : classData?.totalPoints?.toLocaleString() || '0'}
                  unit="pt"
                />
              </div>
            </div>
          </PageSection>

          <PageSection>
            <PageSectionTitle eyebrow="History" title="ポイント履歴" />

            {historyLoading ? (
              <PageEmptyState title="履歴を読み込み中です" />
            ) : history.length === 0 ? (
              <PageEmptyState title="まだポイント履歴がありません" description="行動をするとここに獲得履歴が追加されます。" />
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-[1.15rem] bg-[#0f1418] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{getReasonLabel(item.reason)}</p>
                      <p className="mt-1 text-xs text-white/42">{formatDate(item.createdAt)}</p>
                      {item.details ? <p className="mt-2 text-sm text-white/56">{item.details}</p> : null}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${item.points >= 0 ? 'bg-white/[0.08] text-[#ffb36d]' : 'bg-[#3a1f22] text-[#ffb8bf]'}`}>
                      {item.points >= 0 ? '+' : ''}
                      {item.points}pt
                    </span>
                  </div>
                ))}
              </div>
            )}

            {hasMore ? (
              <button
                onClick={loadMore}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.04] px-4 text-sm font-medium text-white/78 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                さらに表示
              </button>
            ) : null}
          </PageSection>
        </div>

        <div className="space-y-4">
          {userData.role === 'student' && classData ? (
            <PageSection>
              <PageSectionTitle eyebrow="Class Board" title={`${userData.grade}年${userData.class}組`} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <PageMetric
                  label="Class Points"
                  value={classLoading ? '...' : classData.totalPoints.toLocaleString()}
                  unit="pt"
                  tone="soft"
                />
                <PageMetric label="Members" value={classData.memberCount.toLocaleString()} unit="people" />
              </div>
            </PageSection>
          ) : null}

          <PageSection>
            <PageSectionTitle eyebrow="Ranking" title="ランキングへ移動" />
            <p className="text-sm leading-6 text-white/58">
              個人とクラスの順位を見て、現在地を確認できます。
            </p>
            <Link
              to="/ranking"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-[1rem] bg-white text-sm font-medium text-[#11161a] px-4 transition-colors hover:bg-[#d9e4dc]"
            >
              ランキングを見る
            </Link>
          </PageSection>
        </div>
      </div>
    </UserPageShell>
  )
}

function LiveSyncBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/64">
      <span className="h-2 w-2 rounded-full bg-[#d9e4dc]" />
      リアルタイム同期
    </span>
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

  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}
