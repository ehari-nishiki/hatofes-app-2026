import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  onSnapshot,
  Timestamp,
  where,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import AppHeader from '@/components/layout/AppHeader'
import RadioPlayer from '@/components/radio/RadioPlayer'
import { Spinner } from '@/components/ui/Spinner'
import type { RadioConfig, RadioProgram, RadioRequest } from '@/types/firestore'

type ProgramWithId = RadioProgram & { id: string }
type RequestWithId = RadioRequest & { id: string }

export default function RadioPage() {
  const { currentUser, userData } = useAuth()
  const [config, setConfig] = useState<RadioConfig | null>(null)
  const [programs, setPrograms] = useState<ProgramWithId[]>([])
  const [myRequests, setMyRequests] = useState<RequestWithId[]>([])
  const [loading, setLoading] = useState(true)

  // Request form
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [songTitle, setSongTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch radio config (realtime)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'config', 'radio'),
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig(snapshot.data() as RadioConfig)
        } else {
          setConfig({
            isLive: false,
            currentStreamUrl: '',
            streamType: 'youtube',
            requestsEnabled: false,
          })
        }
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching radio config:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Fetch programs
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const programsQuery = query(
          collection(db, 'radioPrograms'),
          orderBy('scheduledStart', 'asc')
        )
        const snapshot = await getDocs(programsQuery)
        const programList: ProgramWithId[] = []
        snapshot.forEach((doc) => {
          programList.push({ id: doc.id, ...doc.data() } as ProgramWithId)
        })
        setPrograms(programList)
      } catch (error) {
        console.error('Error fetching programs:', error)
      }
    }

    fetchPrograms()
  }, [])

  // Fetch my requests
  useEffect(() => {
    if (!currentUser) return

    const fetchMyRequests = async () => {
      try {
        const requestsQuery = query(
          collection(db, 'radioRequests'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        )
        const snapshot = await getDocs(requestsQuery)
        const requestList: RequestWithId[] = []
        snapshot.forEach((doc) => {
          requestList.push({ id: doc.id, ...doc.data() } as RequestWithId)
        })
        setMyRequests(requestList)
      } catch (error) {
        console.error('Error fetching requests:', error)
      }
    }

    fetchMyRequests()
  }, [currentUser])

  // Submit request
  const handleSubmitRequest = async () => {
    if (!currentUser || !userData || !songTitle) return

    setSubmitting(true)
    try {
      const requestId = `request-${Date.now()}`
      await setDoc(doc(db, 'radioRequests', requestId), {
        userId: currentUser.uid,
        username: userData.username,
        songTitle,
        artist: artist || null,
        message: message || null,
        status: 'pending',
        createdAt: Timestamp.now(),
      })

      // Update local state
      setMyRequests((prev) => [
        {
          id: requestId,
          userId: currentUser.uid,
          username: userData.username,
          songTitle,
          artist: artist || undefined,
          message: message || undefined,
          status: 'pending',
          createdAt: Timestamp.now(),
        },
        ...prev,
      ])

      setSongTitle('')
      setArtist('')
      setMessage('')
      setShowRequestForm(false)
      alert('リクエストを送信しました！')
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  // Format time
  const formatTime = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Check if program is current
  const isProgramNow = (program: ProgramWithId) => {
    const now = new Date()
    const start = program.scheduledStart.toDate()
    const end = program.scheduledEnd.toDate()
    return now >= start && now <= end
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hatofes-bg pb-20">
      <AppHeader
        username={userData?.username || ''}
        grade={userData?.grade}
        classNumber={userData?.class}
      />

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/home" className="p-2 -ml-2 text-hatofes-gray hover:text-hatofes-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-hatofes-white font-display flex items-center gap-2">
              <span>📻</span> 鳩ラジ
            </h1>
            <p className="text-xs text-hatofes-gray">Hato Radio</p>
          </div>
        </div>

        {/* Radio Player */}
        {config && <RadioPlayer config={config} />}

        {/* Request Section */}
        {config?.requestsEnabled && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-hatofes-white flex items-center gap-2">
                <span>🎵</span> リクエスト
              </h2>
              <button
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="btn-main text-sm px-4 py-2"
              >
                {showRequestForm ? '閉じる' : 'リクエストする'}
              </button>
            </div>

            {showRequestForm && (
              <div className="card mb-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-hatofes-gray mb-2">曲名 *</label>
                    <input
                      type="text"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                      placeholder="曲名を入力"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-hatofes-gray mb-2">アーティスト</label>
                    <input
                      type="text"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                      placeholder="アーティスト名"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-hatofes-gray mb-2">メッセージ</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={2}
                      className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                      placeholder="パーソナリティへのメッセージ（任意）"
                    />
                  </div>
                  <button
                    onClick={handleSubmitRequest}
                    disabled={submitting || !songTitle}
                    className="btn-main w-full py-3 disabled:opacity-50"
                  >
                    {submitting ? '送信中...' : 'リクエストを送信'}
                  </button>
                </div>
              </div>
            )}

            {/* My Requests */}
            {myRequests.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-bold text-hatofes-gray mb-3">あなたのリクエスト</h3>
                <div className="space-y-2">
                  {myRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between bg-hatofes-dark p-3 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-hatofes-white text-sm truncate">{req.songTitle}</p>
                        {req.artist && (
                          <p className="text-xs text-hatofes-gray truncate">{req.artist}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          req.status === 'played'
                            ? 'bg-green-500/20 text-green-400'
                            : req.status === 'approved'
                            ? 'bg-blue-500/20 text-blue-400'
                            : req.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {req.status === 'played'
                          ? '再生済み'
                          : req.status === 'approved'
                          ? '承認済み'
                          : req.status === 'rejected'
                          ? '却下'
                          : '申請中'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Program Schedule */}
        <section className="mt-6">
          <h2 className="text-lg font-bold text-hatofes-white mb-4 flex items-center gap-2">
            <span>📅</span> 番組表
          </h2>

          {programs.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-hatofes-gray">番組が登録されていません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {programs.map((program) => {
                const isNow = isProgramNow(program)

                return (
                  <div
                    key={program.id}
                    className={`card ${isNow ? 'ring-2 ring-red-500' : ''}`}
                  >
                    {isNow && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span className="text-xs text-red-400 font-bold">ON AIR</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-hatofes-white">{program.title}</h3>
                        {program.hosts && program.hosts.length > 0 && (
                          <p className="text-sm text-hatofes-gray">
                            パーソナリティ: {program.hosts.join(', ')}
                          </p>
                        )}
                        {program.description && (
                          <p className="text-xs text-hatofes-gray mt-1">{program.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-hatofes-gray">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {formatTime(program.scheduledStart)} - {formatTime(program.scheduledEnd)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
