import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  calculateLevel,
  getPointsToNextLevel,
  LEVEL_THRESHOLDS,
  LEVEL_TITLES,
  LEVEL_COLORS,
  MAX_LEVEL,
} from '@/lib/levelSystem'
import {
  PageBackLink,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'
import { Spinner } from '@/components/ui/Spinner'

interface PersonalRankingCacheItem {
  userId: string
  rank: number
}

export default function LevelPage() {
  const { currentUser, userData } = useAuth()
  const [percentile, setPercentile] = useState<number | null>(null)

  const level = userData ? calculateLevel(userData.totalPoints) : 1
  const progress = userData ? getPointsToNextLevel(userData.totalPoints) : null
  const title = LEVEL_TITLES[level]
  const colors = LEVEL_COLORS[level]

  useEffect(() => {
    if (!currentUser || !userData) return

    const fetchPercentile = async () => {
      try {
        const rankingDoc = await getDoc(doc(db, 'config', 'personalRanking'))
        if (!rankingDoc.exists()) return

        const rankings = (rankingDoc.data().rankings || []) as PersonalRankingCacheItem[]
        const userEntry = rankings.find((item) => item.userId === currentUser.uid)
        if (!userEntry) return

        const rank = userEntry.rank
        const total = rankings.length
        const pct = total > 0 ? Math.round(((total - rank + 1) / total) * 100) : 0
        setPercentile(pct)
      } catch (error) {
        console.error('Error fetching percentile:', error)
      }
    }

    fetchPercentile()
  }, [currentUser, userData?.totalPoints])

  if (!userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      <PageHero
        eyebrow="Level"
        title={`Lv.${level} ${title}`}
        description="ポイントの到達状況と、次の称号までの進み具合を確認できます。"
        badge={
          <span
            className="inline-flex rounded-full px-3 py-1 text-xs font-din uppercase tracking-[0.2em]"
            style={{ backgroundColor: `${colors.from}22`, color: colors.from }}
          >
            Current Title
          </span>
        }
        aside={<PageBackLink to="/home" label="ホームに戻る" />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <PageSection>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Current Level</p>
              <p
                className="mt-3 font-display text-5xl font-black leading-none sm:text-6xl"
                style={{
                  background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Lv.{level}
              </p>
              <p
                className="mt-2 font-display text-2xl font-black tracking-[0.08em] sm:text-3xl"
                style={{
                  background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {title}
              </p>
              <p className="mt-3 text-sm text-white/55">{userData.totalPoints.toLocaleString()} pt</p>
            </div>

            {percentile !== null ? (
              <div className="rounded-[1.1rem] bg-black/20 px-4 py-4 sm:min-w-[220px]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Standing</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                  上位 {100 - percentile}%
                </p>
                <p className="mt-1 text-xs text-white/48">全体の {percentile}% のユーザーより上位です</p>
              </div>
            ) : null}
          </div>

          {progress ? (
            <>
              <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress.progress}%`,
                    background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                  }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/56">
                <span>{progress.current.toLocaleString()} / {progress.next.toLocaleString()} pt</span>
                <span>次のレベルまで {(LEVEL_THRESHOLDS[level] - userData.totalPoints).toLocaleString()} pt</span>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[1.1rem] bg-black/20 px-4 py-5">
              <p className="text-lg font-semibold text-white">最高レベル達成</p>
              <p className="mt-1 text-sm text-white/52">これ以上の称号はありません。</p>
            </div>
          )}
        </PageSection>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <PageMetric label="Points" value={userData.totalPoints.toLocaleString()} unit="pt" />
          <PageMetric label="Current" value={`Lv.${level}`} tone="soft" />
          <PageMetric label="Title" value={title} tone="soft" />
        </div>
      </div>

      <PageSection className="mt-4">
        <PageSectionTitle eyebrow="All Titles" title="レベル一覧" />
        <div className="grid gap-3">
          {[...Array(MAX_LEVEL)].map((_, i) => {
            const lvl = MAX_LEVEL - i
            const tierColors = LEVEL_COLORS[lvl]
            const tierTitle = LEVEL_TITLES[lvl]
            const threshold = LEVEL_THRESHOLDS[lvl - 1]
            const isCurrentLevel = lvl === level
            const isUnlocked = lvl <= level

            return (
              <div
                key={lvl}
                className={`flex flex-col gap-3 rounded-[1.1rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                  isCurrentLevel ? 'bg-white/[0.07]' : isUnlocked ? 'bg-white/[0.045]' : 'bg-black/18 opacity-55'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="min-w-[78px] font-display text-2xl font-black"
                    style={{
                      background: `linear-gradient(135deg, ${tierColors.from}, ${tierColors.to})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Lv.{lvl}
                  </span>
                  <div>
                    <p className="font-display text-lg font-bold tracking-[0.06em] text-white">{tierTitle}</p>
                    <p className="text-xs text-white/46">{threshold.toLocaleString()} pt 以上</p>
                  </div>
                </div>
                {isCurrentLevel ? (
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-xs font-din uppercase tracking-[0.2em]"
                    style={{ backgroundColor: `${tierColors.from}22`, color: tierColors.from }}
                  >
                    Current
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </PageSection>
    </UserPageShell>
  )
}
