import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getCountFromServer } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import {
  calculateLevel,
  getPointsToNextLevel,
  LEVEL_THRESHOLDS,
  LEVEL_TITLES,
  LEVEL_COLORS,
  MAX_LEVEL,
} from '@/lib/levelSystem'

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
        const higherSnap = await getCountFromServer(
          query(collection(db, 'users'), where('totalPoints', '>', userData.totalPoints))
        )
        const totalSnap = await getCountFromServer(query(collection(db, 'users')))

        const rank = higherSnap.data().count + 1
        const total = totalSnap.data().count
        const pct = Math.round(((total - rank + 1) / total) * 100)
        setPercentile(pct)
      } catch (error) {
        console.error('Error fetching percentile:', error)
      }
    }

    fetchPercentile()
  }, [currentUser, userData?.totalPoints])

  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">Loading...</div>
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

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Current Level */}
        <section className="card text-center">
          <p className="text-sm text-hatofes-gray mb-2">現在のレベル</p>
          <div
            className="text-6xl font-bold font-display mb-2"
            style={{
              background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Lv.{level}
          </div>
          <p
            className="text-lg font-bold font-display"
            style={{
              background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {title}
          </p>
          <p className="text-sm text-hatofes-gray mt-2 font-display">
            {userData.totalPoints.toLocaleString()} pt
          </p>
        </section>

        {/* Progress to Next Level */}
        {progress ? (
          <section className="card">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-hatofes-white">次のレベル: Lv.{level + 1}</p>
              <p className="text-sm text-hatofes-gray font-display">
                {progress.current.toLocaleString()} / {progress.next.toLocaleString()} pt
              </p>
            </div>
            <div className="w-full h-3 bg-hatofes-dark rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress.progress}%`,
                  background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                }}
              />
            </div>
            <p className="text-xs text-hatofes-gray mt-2 text-right">
              あと {(LEVEL_THRESHOLDS[level] - userData.totalPoints).toLocaleString()} pt
            </p>
          </section>
        ) : (
          <section className="card text-center">
            <p className="text-hatofes-accent-yellow font-bold">最高レベル達成!</p>
            <p className="text-sm text-hatofes-gray mt-1">おめでとうございます!</p>
          </section>
        )}

        {/* Percentile */}
        {percentile !== null && (
          <section className="card text-center">
            <p className="text-sm text-hatofes-gray mb-2">あなたの順位</p>
            <p className="text-3xl font-bold font-display text-gradient">
              上位 {100 - percentile}%
            </p>
            <p className="text-xs text-hatofes-gray mt-1">
              全体の {percentile}% のユーザーより上位です
            </p>
          </section>
        )}

        {/* Level Pyramid */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4 text-center">レベル一覧</h2>
          <div className="space-y-2">
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
                  className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                    isCurrentLevel
                      ? 'border-2'
                      : isUnlocked
                      ? 'bg-hatofes-dark'
                      : 'bg-hatofes-dark/50 opacity-50'
                  }`}
                  style={{
                    borderColor: isCurrentLevel ? tierColors.from : 'transparent',
                    background: isCurrentLevel
                      ? `linear-gradient(135deg, ${tierColors.from}15, ${tierColors.to}10)`
                      : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-lg font-bold font-display w-12"
                      style={{
                        background: `linear-gradient(135deg, ${tierColors.from}, ${tierColors.to})`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      Lv.{lvl}
                    </span>
                    <span className="text-sm text-hatofes-white">{tierTitle}</span>
                  </div>
                  <span className="text-xs text-hatofes-gray font-display">
                    {threshold.toLocaleString()}pt+
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Back Button */}
        <Link to="/home" className="block">
          <div className="btn-sub w-full py-3 text-center">ホームに戻る</div>
        </Link>
      </main>
    </div>
  )
}
