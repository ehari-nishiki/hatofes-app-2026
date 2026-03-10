import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { Toast, useToast } from '@/components/ui/Toast'
import type { Booth, StampRallyEntry } from '@/types/firestore'

export default function StampRallyPage() {
  const { currentUser, userData } = useAuth()
  const { toast, showToast, hideToast } = useToast()

  const [booths, setBooths] = useState<(Booth & { id: string })[]>([])
  const [stamps, setStamps] = useState<(StampRallyEntry & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [stampCode, setStampCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch booths and stamp entries
  useEffect(() => {
    if (!currentUser) return

    const fetchData = async () => {
      try {
        const [boothsSnap, stampsSnap] = await Promise.all([
          getDocs(query(collection(db, 'booths'), where('isActive', '==', true))),
          getDocs(query(collection(db, 'stampRally'), where('userId', '==', currentUser.uid))),
        ])

        const boothList: (Booth & { id: string })[] = []
        boothsSnap.forEach((doc) => {
          boothList.push({ id: doc.id, ...doc.data() } as Booth & { id: string })
        })
        setBooths(boothList)

        const stampList: (StampRallyEntry & { id: string })[] = []
        stampsSnap.forEach((doc) => {
          stampList.push({ id: doc.id, ...doc.data() } as StampRallyEntry & { id: string })
        })
        setStamps(stampList)
      } catch (error) {
        console.error('Error fetching stamp rally data:', error)
        showToast('データの取得に失敗しました', 'error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentUser])

  // Verify stamp code
  const handleSubmitCode = async () => {
    if (!stampCode.trim() || submitting) return

    setSubmitting(true)
    try {
      const functions = getFunctions(app)
      const verifyStampCodeFn = httpsCallable<
        { stampCode: string },
        { success: boolean; message: string; boothName?: string; pointsAwarded?: number }
      >(functions, 'verifyStampCode')

      const result = await verifyStampCodeFn({ stampCode: stampCode.trim() })
      const data = result.data

      if (data.success) {
        showToast(
          data.boothName
            ? `${data.boothName} のスタンプを獲得！${data.pointsAwarded ? ` (+${data.pointsAwarded}pt)` : ''}`
            : data.message,
          'success'
        )
        setStampCode('')

        // Refresh stamp entries
        if (currentUser) {
          const stampsSnap = await getDocs(
            query(collection(db, 'stampRally'), where('userId', '==', currentUser.uid))
          )
          const stampList: (StampRallyEntry & { id: string })[] = []
          stampsSnap.forEach((doc) => {
            stampList.push({ id: doc.id, ...doc.data() } as StampRallyEntry & { id: string })
          })
          setStamps(stampList)
        }
      } else {
        showToast(data.message || 'スタンプコードが無効です', 'error')
      }
    } catch (error) {
      console.error('Error verifying stamp code:', error)
      showToast('スタンプコードの確認に失敗しました', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const visitedBoothIds = new Set(stamps.map((s) => s.boothId))
  const collected = booths.filter((b) => visitedBoothIds.has(b.id!)).length
  const total = booths.length
  const allCollected = total > 0 && collected === total

  if (loading) {
    return (
      <div className="min-h-screen bg-hatofes-bg">
        <AppHeader
          username={userData?.username || ''}
          grade={userData?.grade}
          classNumber={userData?.class}
        />
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="min-h-screen bg-hatofes-bg pb-20">
        <AppHeader
          username={userData?.username || ''}
          grade={userData?.grade}
          classNumber={userData?.class}
        />

        <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Back button */}
          <Link
            to="/home"
            className="inline-flex items-center gap-1 text-hatofes-gray hover:text-hatofes-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            ホームに戻る
          </Link>

          {/* Header */}
          <section className="card">
            <h1 className="text-xl font-bold text-hatofes-white text-center mb-2">
              スタンプラリー
            </h1>
            <p className="text-sm text-hatofes-gray text-center mb-4">
              各ブースを巡ってスタンプを集めよう！
            </p>

            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-2xl font-bold text-gradient font-display">{collected}</span>
              <span className="text-hatofes-gray text-lg">/</span>
              <span className="text-lg font-bold text-hatofes-white font-display">{total}</span>
              <span className="text-sm text-hatofes-gray ml-1">スタンプ</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-3 bg-hatofes-dark rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: total > 0 ? `${(collected / total) * 100}%` : '0%',
                  background: allCollected
                    ? 'linear-gradient(90deg, #10B981, #34D399)'
                    : 'linear-gradient(90deg, #FFC300, #FF4E00)',
                }}
              />
            </div>
          </section>

          {/* Congratulatory message */}
          {allCollected && (
            <section className="card border border-feature-stamp/50 bg-gradient-to-r from-feature-stamp/10 to-transparent">
              <div className="text-center py-2">
                <svg className="w-12 h-12 mx-auto mb-3 text-feature-stamp" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-bold text-feature-stamp mb-1">
                  全スタンプ制覇おめでとう！
                </h2>
                <p className="text-sm text-hatofes-gray">
                  すべてのブースを巡りました！素晴らしい！
                </p>
              </div>
            </section>
          )}

          {/* Stamp code input */}
          <section className="card">
            <h2 className="font-bold text-hatofes-white mb-3 text-sm">スタンプコード入力</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={stampCode}
                onChange={(e) => setStampCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitCode()
                }}
                placeholder="ブースのコードを入力"
                className="flex-1 bg-hatofes-dark border border-hatofes-gray/50 rounded-lg px-3 py-2.5 text-sm text-hatofes-white placeholder-hatofes-gray focus:outline-none focus:border-hatofes-accent-yellow/50 focus:ring-1 focus:ring-hatofes-accent-yellow/30 transition-colors"
              />
              <button
                onClick={handleSubmitCode}
                disabled={!stampCode.trim() || submitting}
                className="bg-hatofes-accent-yellow text-hatofes-dark font-bold text-sm px-4 py-2.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hatofes-accent-yellow/90 transition-colors flex items-center gap-1.5"
              >
                {submitting ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    送信
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Stamp card grid */}
          <section className="card">
            <h2 className="font-bold text-hatofes-white mb-4 text-sm">スタンプカード</h2>

            {booths.length === 0 ? (
              <p className="text-sm text-hatofes-gray text-center py-6">
                現在アクティブなブースはありません
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {booths.map((booth) => {
                  const visited = visitedBoothIds.has(booth.id!)
                  return (
                    <div
                      key={booth.id}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center p-2 transition-all ${
                        visited
                          ? 'bg-gradient-to-br from-feature-stamp/20 to-feature-stamp/10 border border-feature-stamp/40'
                          : 'bg-hatofes-dark border border-hatofes-gray/30'
                      }`}
                    >
                      {visited ? (
                        <svg
                          className="w-8 h-8 text-feature-stamp mb-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-hatofes-gray/50 mb-1" />
                      )}
                      <p
                        className={`text-xs text-center leading-tight line-clamp-2 ${
                          visited ? 'text-feature-stamp font-bold' : 'text-hatofes-gray'
                        }`}
                      >
                        {booth.name}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  )
}
