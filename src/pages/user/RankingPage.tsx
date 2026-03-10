import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { CacheService } from '@/lib/cacheService'
import { ShareCard } from '@/components/ui/ShareCard'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

interface RankedUser {
  id: string
  username: string
  grade?: number
  class?: string
  totalPoints: number
  rank: number
}

interface ClassRanking {
  classId: string
  grade: number
  className: string
  totalPoints: number
  memberCount: number
  rank: number
}

interface PersonalRankingCacheItem {
  userId: string
  username: string
  grade?: number
  class?: string
  totalPoints: number
  rank: number
}

interface ClassRankingCacheItem {
  classId: string
  grade: number
  className: string
  totalPoints: number
  memberCount: number
  rank: number
}

export default function RankingPage() {
  const { currentUser, userData } = useAuth()
  const [activeTab, setActiveTab] = useState<'individual' | 'class'>('individual')
  const [individualRanking, setIndividualRanking] = useState<RankedUser[]>([])
  const [classRanking, setClassRanking] = useState<ClassRanking[]>([])
  const [userRank, setUserRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const cachedIndividual = CacheService.get<RankedUser[]>('ranking_individual')
        const cachedClass = CacheService.get<ClassRanking[]>('ranking_class')
        const cachedUserRank = CacheService.get<number>('ranking_user_rank')

        if (cachedIndividual && cachedClass) {
          setIndividualRanking(cachedIndividual)
          setClassRanking(cachedClass)
          if (cachedUserRank !== null) {
            setUserRank(cachedUserRank)
          }
          setLoading(false)
          return
        }

        const personalRankingDoc = await getDoc(doc(db, 'config', 'personalRanking'))
        const classRankingDoc = await getDoc(doc(db, 'config', 'classRanking'))

        if (personalRankingDoc.exists()) {
          const cachedRankings = (personalRankingDoc.data().rankings || []) as PersonalRankingCacheItem[]
          const userList: RankedUser[] = cachedRankings.map((item) => ({
            id: item.userId,
            username: item.username,
            grade: item.grade,
            class: item.class,
            totalPoints: item.totalPoints,
            rank: item.rank,
          }))
          setIndividualRanking(userList)
          CacheService.set('ranking_individual', userList, 10 * 60 * 1000)

          if (currentUser) {
            const userInRanking = cachedRankings.find((item) => item.userId === currentUser.uid)
            if (userInRanking) {
              setUserRank(userInRanking.rank)
              CacheService.set('ranking_user_rank', userInRanking.rank, 10 * 60 * 1000)
            }
          }
        }

        if (classRankingDoc.exists()) {
          const cachedClassRankings = (classRankingDoc.data().rankings || []) as ClassRankingCacheItem[]
          const classRankList: ClassRanking[] = cachedClassRankings.map((item) => ({
            classId: item.classId,
            grade: item.grade,
            className: item.className,
            totalPoints: item.totalPoints,
            memberCount: item.memberCount,
            rank: item.rank,
          }))
          setClassRanking(classRankList)
          CacheService.set('ranking_class', classRankList, 10 * 60 * 1000)
        }
      } catch (error) {
        console.error('Error fetching rankings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRankings()
  }, [currentUser])

  if (!userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <div className="text-white">読み込み中...</div>
      </div>
    )
  }

  const activeList = activeTab === 'individual' ? individualRanking : classRanking
  const topThree = activeList.filter((item) => item.rank <= 3)

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      <PageHero
        eyebrow="Leaderboard"
        title="Ranking"
        description="個人とクラスの現在地を見て、どこで差がついているかを確認できます。"
        badge={<span className="rounded-full bg-gradient-to-r from-[#ffc44d] to-[#ff7a18] px-3 py-1 text-xs font-semibold text-[#11161a]">Festival Board</span>}
        aside={<PageBackLink />}
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          {userRank ? (
            <PageSection>
              <PageSectionTitle eyebrow="Your Position" title="現在の順位" />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-3">
                  <PageMetric label="Personal Rank" value={`${userRank}位`} tone="accent" />
                  <PageMetric label="Current Score" value={userData.totalPoints.toLocaleString()} unit="pt" />
                </div>
                <div className="flex justify-start sm:justify-end">
                  <ShareCard
                    title="鳩祭ランキング"
                    subtitle={`${userData.username} - ${userRank}位`}
                    value={userData.totalPoints.toLocaleString()}
                  />
                </div>
              </div>
            </PageSection>
          ) : null}

          <PageSection>
            <PageSectionTitle eyebrow="Mode" title="表示切替" />
            <div className="grid grid-cols-2 gap-2">
              <ToggleButton active={activeTab === 'individual'} onClick={() => setActiveTab('individual')}>
                個人
              </ToggleButton>
              <ToggleButton active={activeTab === 'class'} onClick={() => setActiveTab('class')}>
                クラス
              </ToggleButton>
            </div>
          </PageSection>

          <PageSection>
            <PageSectionTitle eyebrow="Podium" title="Top 3" />
            {loading ? (
              <PageEmptyState title="ランキングを読み込み中です" />
            ) : topThree.length === 0 ? (
              <PageEmptyState title="ランキングデータがありません" />
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((rank) => {
                  const item = topThree.find((entry) => entry.rank === rank)
                  if (!item) {
                    return <div key={rank} className="rounded-[1.2rem] bg-[#0f1418] p-4" />
                  }

                  const name = activeTab === 'individual'
                    ? (item as RankedUser).username
                    : `${(item as ClassRanking).grade}年${(item as ClassRanking).className}組`
                  const points = activeTab === 'individual'
                    ? (item as RankedUser).totalPoints
                    : (item as ClassRanking).totalPoints

                  return (
                    <div key={rank} className={`rounded-[1.2rem] p-4 ${
                      rank === 1
                        ? 'bg-gradient-to-br from-[#ffc44d] to-[#ff7a18] text-[#11161a]'
                        : 'bg-[#0f1418] text-white'
                    }`}>
                      <p className="text-[11px] uppercase tracking-[0.18em] opacity-55">#{rank}</p>
                      <p className="mt-3 line-clamp-2 text-sm font-semibold">{name}</p>
                      <p className="mt-2 text-xl font-semibold tracking-[-0.05em]">{points.toLocaleString()}pt</p>
                    </div>
                  )
                })}
              </div>
            )}
          </PageSection>
        </div>

        <PageSection>
          <PageSectionTitle
            eyebrow="Live Table"
            title={activeTab === 'individual' ? '個人ランキング' : 'クラスランキング'}
            meta={<span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/58">{activeList.length} entries</span>}
          />

          {loading ? (
            <PageEmptyState title="ランキングを読み込み中です" />
          ) : activeList.length === 0 ? (
            <PageEmptyState title="表示できるデータがありません" />
          ) : (
            <div className="space-y-2">
              {activeTab === 'individual'
                ? individualRanking.map((user) => (
                    <div
                      key={user.id}
                      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.1rem] px-4 py-3 ${
                        currentUser?.uid === user.id ? 'bg-[#d9e4dc] text-[#11161a]' : 'bg-[#0f1418] text-white'
                      }`}
                    >
                      <RankChip rank={user.rank} active={currentUser?.uid === user.id} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.username}</p>
                        {user.grade && user.class ? (
                          <p className={`text-xs ${currentUser?.uid === user.id ? 'text-[#11161a]/55' : 'text-white/42'}`}>
                            {user.grade}年{user.class}組
                          </p>
                        ) : null}
                      </div>
                      <span className={`text-sm font-semibold ${currentUser?.uid === user.id ? 'text-[#11161a]' : 'text-white/78'}`}>
                        {user.totalPoints.toLocaleString()}pt
                      </span>
                    </div>
                  ))
                : classRanking.map((cls) => {
                    const isUserClass = userData.grade === cls.grade && userData.class === cls.className
                    return (
                      <div
                        key={cls.classId}
                        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.1rem] px-4 py-3 ${
                          isUserClass ? 'bg-[#d9e4dc] text-[#11161a]' : 'bg-[#0f1418] text-white'
                        }`}
                      >
                        <RankChip rank={cls.rank} active={isUserClass} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{cls.grade}年{cls.className}組</p>
                          <p className={`text-xs ${isUserClass ? 'text-[#11161a]/55' : 'text-white/42'}`}>
                            {cls.memberCount}人
                          </p>
                        </div>
                        <span className={`text-sm font-semibold ${isUserClass ? 'text-[#11161a]' : 'text-white/78'}`}>
                          {cls.totalPoints.toLocaleString()}pt
                        </span>
                      </div>
                    )
                  })}
            </div>
          )}
        </PageSection>
      </div>
    </UserPageShell>
  )
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      onClick={onClick}
      className={`h-11 rounded-[1rem] text-sm font-medium transition-colors ${
        active ? 'bg-white text-[#11161a]' : 'bg-[#0f1418] text-white/68 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function RankChip({ rank, active }: { rank: number; active: boolean }) {
  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
        active ? 'bg-[#11161a] text-white' : 'bg-white/[0.08] text-white/74'
      }`}
    >
      {rank}
    </span>
  )
}
