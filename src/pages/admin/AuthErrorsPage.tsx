import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { AUTH_ERRORS } from '@/lib/authErrors'
import type { AuthErrorLog } from '@/lib/authErrors'

interface ErrorStats {
  [key: string]: number
}

type TimeRange = '1h' | '24h' | '7d' | 'all'

export default function AuthErrorsPage() {
  const { userData } = useAuth()
  const [errors, setErrors] = useState<(AuthErrorLog & { id: string })[]>([])
  const [errorStats, setErrorStats] = useState<ErrorStats>({})
  const [loading, setLoading] = useState(true)
  const [selectedErrorCode, setSelectedErrorCode] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')

  useEffect(() => {
    const fetchErrors = async () => {
      setLoading(true)
      try {
        // Calculate time filter
        let startTime: Timestamp | null = null
        if (timeRange !== 'all') {
          const now = new Date()
          if (timeRange === '1h') {
            now.setHours(now.getHours() - 1)
          } else if (timeRange === '24h') {
            now.setDate(now.getDate() - 1)
          } else if (timeRange === '7d') {
            now.setDate(now.getDate() - 7)
          }
          startTime = Timestamp.fromDate(now)
        }

        // Build query
        let errorsQuery = query(
          collection(db, 'authErrors'),
          orderBy('context.timestamp', 'desc'),
          limit(100)
        )

        if (selectedErrorCode !== 'all') {
          errorsQuery = query(
            collection(db, 'authErrors'),
            where('errorCode', '==', selectedErrorCode),
            orderBy('context.timestamp', 'desc'),
            limit(100)
          )
        }

        const errorsSnap = await getDocs(errorsQuery)
        const errorList: (AuthErrorLog & { id: string })[] = []
        const stats: ErrorStats = {}

        errorsSnap.forEach((docSnap) => {
          const data = docSnap.data() as AuthErrorLog

          // Apply time filter in client (since we can't combine where + orderBy on different fields)
          if (startTime && data.context.timestamp.seconds < startTime.seconds) {
            return
          }

          errorList.push({ id: docSnap.id, ...data })

          // Count by error code
          stats[data.errorCode] = (stats[data.errorCode] || 0) + 1
        })

        setErrors(errorList)
        setErrorStats(stats)
      } catch (error) {
        console.error('Error fetching auth errors:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchErrors()
  }, [selectedErrorCode, timeRange])

  if (!userData || (userData.role !== 'admin' && userData.role !== 'staff')) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <p className="text-hatofes-white">アクセス権限がありません</p>
      </div>
    )
  }

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
    return date.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-hatofes-bg pb-20">
      <header className="bg-hatofes-dark border-b border-hatofes-gray-lighter">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gradient font-display">Auth Errors Monitor</h1>
          <p className="text-sm text-hatofes-gray-light mt-1">認証エラー監視</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Error Stats Summary */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">エラーコード別集計</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(AUTH_ERRORS).map(([code, details]) => (
              <div
                key={code}
                className="p-3 rounded-lg bg-hatofes-dark border border-hatofes-gray-lighter"
              >
                <div className="flex justify-between items-start">
                  <span className="font-display text-sm text-hatofes-accent-yellow">{code}</span>
                  <span className="font-display text-lg font-bold text-gradient">
                    {errorStats[code] || 0}
                  </span>
                </div>
                <p className="text-xs text-hatofes-gray-light mt-1 line-clamp-2">
                  {details.message}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Filters */}
        <section className="card">
          <div className="flex flex-wrap gap-4">
            {/* Error Code Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-hatofes-gray-light mb-2">エラーコード</label>
              <select
                value={selectedErrorCode}
                onChange={(e) => setSelectedErrorCode(e.target.value)}
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
              >
                <option value="all">全て</option>
                {Object.keys(AUTH_ERRORS).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-hatofes-gray-light mb-2">期間</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
              >
                <option value="1h">過去1時間</option>
                <option value="24h">過去24時間</option>
                <option value="7d">過去7日間</option>
                <option value="all">全期間</option>
              </select>
            </div>
          </div>
        </section>

        {/* Error List */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">
            エラーログ
            <span className="ml-2 text-sm font-normal text-hatofes-gray-light">
              ({errors.length}件)
            </span>
          </h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-hatofes-accent-yellow"></div>
              <p className="text-hatofes-gray-light mt-2">読み込み中...</p>
            </div>
          ) : errors.length === 0 ? (
            <p className="text-center text-hatofes-gray-light py-8">エラーログがありません</p>
          ) : (
            <div className="space-y-3">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className="p-4 rounded-lg bg-hatofes-dark border border-hatofes-gray-lighter hover:border-hatofes-gray transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-display text-sm font-bold text-hatofes-accent-yellow">
                        {error.errorCode}
                      </span>
                      <span className="text-xs text-hatofes-gray-light ml-2">
                        {formatDate(error.context.timestamp)}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-hatofes-accent-orange/20 text-hatofes-accent-orange">
                      {error.context.step}
                    </span>
                  </div>

                  <p className="text-sm text-hatofes-white mb-2">{error.errorMessage}</p>

                  {error.context.email && (
                    <p className="text-xs text-hatofes-gray-light mb-1">
                      Email: {error.context.email}
                    </p>
                  )}

                  {error.userId && (
                    <p className="text-xs text-hatofes-gray-light mb-1">
                      User ID: {error.userId}
                    </p>
                  )}

                  <p className="text-xs text-hatofes-gray-light mb-2">
                    URL: {error.context.url}
                  </p>

                  {error.stackTrace && (
                    <details className="mt-2">
                      <summary className="text-xs text-hatofes-gray cursor-pointer hover:text-hatofes-white">
                        Stack Trace
                      </summary>
                      <pre className="mt-2 p-2 bg-hatofes-black rounded text-xs text-hatofes-gray-light overflow-x-auto">
                        {error.stackTrace}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Error Code Reference */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">エラーコード早見表</h2>
          <div className="space-y-3">
            {Object.entries(AUTH_ERRORS).map(([code, details]) => (
              <div
                key={code}
                className="p-3 rounded-lg bg-hatofes-dark border border-hatofes-gray-lighter"
              >
                <div className="flex items-start gap-3">
                  <span className="font-display text-sm font-bold text-hatofes-accent-yellow whitespace-nowrap">
                    {code}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-hatofes-white mb-1">{details.message}</p>
                    <p className="text-xs text-hatofes-gray-light">
                      発生箇所: {details.locations.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
