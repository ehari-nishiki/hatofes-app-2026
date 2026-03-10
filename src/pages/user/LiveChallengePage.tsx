import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import type { LiveChallenge, LiveChallengeClassScore } from '@/types/firestore'

interface ChallengeWithScores extends LiveChallenge {
  id: string
  classScores: LiveChallengeClassScore[]
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function CountdownDisplay({ targetTime }: { targetTime: Date }) {
  const [remaining, setRemaining] = useState(() => targetTime.getTime() - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(targetTime.getTime() - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [targetTime])

  return (
    <div className="text-center">
      <p className="text-sm text-hatofes-gray-light mb-1">開始まで</p>
      <p className="text-3xl font-mono font-bold text-hatofes-accent-yellow">
        {formatCountdown(remaining)}
      </p>
    </div>
  )
}

function ActiveTimer({ endTime }: { endTime: Date }) {
  const [remaining, setRemaining] = useState(() => endTime.getTime() - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(endTime.getTime() - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [endTime])

  const isUrgent = remaining < 60000

  return (
    <div className="text-center">
      <p className="text-sm text-hatofes-gray-light mb-1">残り時間</p>
      <p className={`text-3xl font-mono font-bold ${isUrgent ? 'text-status-error animate-pulse' : 'text-status-success'}`}>
        {formatCountdown(remaining)}
      </p>
    </div>
  )
}

function Leaderboard({
  scores,
  userClassId,
  isActive,
}: {
  scores: LiveChallengeClassScore[]
  userClassId: string | null
  isActive: boolean
}) {
  if (scores.length === 0) {
    return <p className="text-hatofes-gray-light text-sm text-center py-4">スコアデータがありません</p>
  }

  return (
    <div className="space-y-2">
      {scores.map((score, index) => {
        const isUserClass = score.classId === userClassId
        const rank = index + 1
        const medalColors = ['text-hatofes-accent-yellow', 'text-hatofes-gray-light', 'text-hatofes-accent-orange']
        const medalEmoji = rank <= 3 ? ['1st', '2nd', '3rd'][index] : null

        return (
          <div
            key={score.classId}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              isUserClass
                ? isActive
                  ? 'bg-hatofes-accent-yellow/20 ring-2 ring-hatofes-accent-yellow'
                  : 'bg-hatofes-accent-yellow/10 ring-1 ring-hatofes-accent-yellow/50'
                : 'bg-white/5'
            }`}
          >
            <div className={`w-8 text-center font-bold text-lg ${rank <= 3 ? medalColors[rank - 1] : 'text-hatofes-gray'}`}>
              {medalEmoji ? (
                <span className="text-xl">{rank}</span>
              ) : (
                rank
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold truncate ${isUserClass ? 'text-hatofes-accent-yellow' : 'text-hatofes-white'}`}>
                {score.grade}-{score.className}
                {isUserClass && (
                  <span className="ml-2 text-xs bg-hatofes-accent-yellow/30 text-hatofes-accent-yellow px-2 py-0.5 rounded-full">
                    あなたのクラス
                  </span>
                )}
              </p>
              <p className="text-xs text-hatofes-gray-light">{score.memberCount}人参加</p>
            </div>
            <div className="text-right">
              <p className={`font-bold text-lg ${isUserClass ? 'text-hatofes-accent-yellow' : 'text-hatofes-white'}`}>
                {score.totalPoints.toLocaleString()}
              </p>
              <p className="text-xs text-hatofes-gray-light">pt</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function LiveChallengePage() {
  const { userData } = useAuth()
  const [challenges, setChallenges] = useState<ChallengeWithScores[]>([])
  const [loading, setLoading] = useState(true)

  const userClassId = userData?.grade && userData?.class
    ? `${userData.grade}-${userData.class}`
    : null

  const fetchClassScores = useCallback(async (challengeId: string): Promise<LiveChallengeClassScore[]> => {
    const scoresRef = collection(db, 'liveChallenges', challengeId, 'classScores')
    const scoresQuery = query(scoresRef, orderBy('totalPoints', 'desc'))
    const snapshot = await getDocs(scoresQuery)
    return snapshot.docs.map((doc) => doc.data() as LiveChallengeClassScore)
  }, [])

  useEffect(() => {
    // Fetch upcoming and active challenges
    const challengesRef = collection(db, 'liveChallenges')
    const q = query(
      challengesRef,
      where('status', 'in', ['active', 'upcoming', 'ended']),
      orderBy('startTime', 'asc')
    )

    let activeUnsubscribers: (() => void)[] = []

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Clean up previous active subscriptions
      activeUnsubscribers.forEach((unsub) => unsub())
      activeUnsubscribers = []

      const challengeDocs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as (LiveChallenge & { id: string })[]

      // Initial load: fetch all class scores
      const withScores: ChallengeWithScores[] = await Promise.all(
        challengeDocs.map(async (challenge) => {
          const classScores = await fetchClassScores(challenge.id)
          return { ...challenge, classScores }
        })
      )

      setChallenges(withScores)
      setLoading(false)

      // Subscribe to real-time class score updates for active challenges
      challengeDocs
        .filter((c) => c.status === 'active')
        .forEach((challenge) => {
          const scoresRef = collection(db, 'liveChallenges', challenge.id, 'classScores')
          const scoresQuery = query(scoresRef, orderBy('totalPoints', 'desc'))
          const unsubScores = onSnapshot(scoresQuery, (scoresSnap) => {
            const updatedScores = scoresSnap.docs.map((doc) => doc.data() as LiveChallengeClassScore)
            setChallenges((prev) =>
              prev.map((c) =>
                c.id === challenge.id ? { ...c, classScores: updatedScores } : c
              )
            )
          })
          activeUnsubscribers.push(unsubScores)
        })
    })

    return () => {
      unsubscribe()
      activeUnsubscribers.forEach((unsub) => unsub())
    }
  }, [fetchClassScores])

  const activeChallenges = challenges.filter((c) => c.status === 'active')
  const upcomingChallenges = challenges.filter((c) => c.status === 'upcoming')
  const endedChallenges = challenges.filter((c) => c.status === 'ended')

  return (
    <div className="min-h-screen bg-hatofes-bg text-hatofes-white">
      <AppHeader />

      <main className="max-w-lg mx-auto px-4 pb-24 pt-4">
        {/* Back button */}
        <Link
          to="/home"
          className="inline-flex items-center gap-1 text-sm text-hatofes-gray hover:text-hatofes-white transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          ホームに戻る
        </Link>

        <h1 className="text-2xl font-bold mb-6">ライブチャレンジ</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : challenges.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-hatofes-gray-light text-lg">チャレンジはまだありません</p>
            <p className="text-hatofes-gray text-sm mt-2">新しいチャレンジが始まるのをお待ちください</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active challenges */}
            {activeChallenges.map((challenge) => (
              <section
                key={challenge.id}
                className="card relative overflow-hidden ring-2 ring-status-success animate-pulse-border"
                style={{
                  animation: 'pulse-border 2s ease-in-out infinite',
                }}
              >
                {/* Gradient accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-status-success via-hatofes-accent-yellow to-status-success" />

                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-status-success/20 text-status-success ring-1 ring-status-success/50">
                      <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                      LIVE
                    </span>
                    <h2 className="text-lg font-bold">{challenge.title}</h2>
                  </div>

                  {challenge.description && (
                    <p className="text-sm text-hatofes-gray-light mb-4">{challenge.description}</p>
                  )}

                  <ActiveTimer endTime={challenge.endTime.toDate()} />

                  {challenge.bonusPoints && (
                    <p className="text-center text-sm text-hatofes-accent-yellow mt-2">
                      優勝クラスに +{challenge.bonusPoints} pt
                    </p>
                  )}

                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-hatofes-gray-light mb-2 uppercase tracking-wider">リアルタイム順位</h3>
                    <Leaderboard scores={challenge.classScores} userClassId={userClassId} isActive />
                  </div>
                </div>
              </section>
            ))}

            {/* Upcoming challenges */}
            {upcomingChallenges.map((challenge) => (
              <section key={challenge.id} className="card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange" />

                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow">
                      まもなく開始
                    </span>
                    <h2 className="text-lg font-bold">{challenge.title}</h2>
                  </div>

                  {challenge.description && (
                    <p className="text-sm text-hatofes-gray-light mb-4">{challenge.description}</p>
                  )}

                  <CountdownDisplay targetTime={challenge.startTime.toDate()} />

                  {challenge.bonusPoints && (
                    <p className="text-center text-sm text-hatofes-accent-yellow mt-2">
                      優勝クラスに +{challenge.bonusPoints} pt
                    </p>
                  )}
                </div>
              </section>
            ))}

            {/* Ended challenges */}
            {endedChallenges.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-hatofes-gray uppercase tracking-wider mb-3">終了したチャレンジ</h2>
                {endedChallenges.map((challenge) => (
                  <section key={challenge.id} className="card relative overflow-hidden opacity-75 mb-4">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-hatofes-gray" />

                    <div className="pt-2">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-hatofes-gray/30 text-hatofes-gray-light">
                          終了
                        </span>
                        <h2 className="text-lg font-bold text-hatofes-gray-light">{challenge.title}</h2>
                      </div>

                      {challenge.description && (
                        <p className="text-sm text-hatofes-gray mb-4">{challenge.description}</p>
                      )}

                      <div>
                        <h3 className="text-sm font-semibold text-hatofes-gray mb-2 uppercase tracking-wider">最終結果</h3>
                        <Leaderboard scores={challenge.classScores} userClassId={userClassId} isActive={false} />
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Pulsing border animation */}
    </div>
  )
}
