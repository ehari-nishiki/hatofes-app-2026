import { useEffect, useState } from 'react'
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import RadioPlayer from '@/components/radio/RadioPlayer'
import { Spinner } from '@/components/ui/Spinner'
import { Toast, useToast } from '@/components/ui/Toast'
import { LiveReactions } from '@/components/ui/LiveReactions'
import type { RadioConfig, RadioProgram, RadioRequest } from '@/types/firestore'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

type ProgramWithId = RadioProgram & { id: string }
type RequestWithId = RadioRequest & { id: string }

export default function RadioPage() {
  const { currentUser, userData } = useAuth()
  const [config, setConfig] = useState<RadioConfig | null>(null)
  const [programs, setPrograms] = useState<ProgramWithId[]>([])
  const [myRequests, setMyRequests] = useState<RequestWithId[]>([])
  const [loading, setLoading] = useState(true)
  const { toast, showToast, hideToast } = useToast()
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [songTitle, setSongTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const programsQuery = query(collection(db, 'radioPrograms'), orderBy('scheduledStart', 'asc'))
        const snapshot = await getDocs(programsQuery)
        setPrograms(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ProgramWithId)))
      } catch (error) {
        console.error('Error fetching programs:', error)
      }
    }

    fetchPrograms()
  }, [])

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
        setMyRequests(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as RequestWithId)))
      } catch (error) {
        console.error('Error fetching requests:', error)
      }
    }

    fetchMyRequests()
  }, [currentUser])

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
      showToast('リクエストを送信しました', 'success')
    } catch (error) {
      console.error('Error submitting request:', error)
      showToast('送信に失敗しました', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (timestamp: Timestamp) => timestamp.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const isProgramNow = (program: ProgramWithId) => {
    const now = new Date()
    return now >= program.scheduledStart.toDate() && now <= program.scheduledEnd.toDate()
  }

  if (loading || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      {toast ? <Toast message={toast.message} type={toast.type} onClose={hideToast} /> : null}

      <PageHero
        eyebrow="Streaming"
        title="Hato Radio"
        description="ライブ配信、番組表、楽曲リクエストをひとつの画面で確認できます。"
        aside={<PageBackLink />}
        badge={config?.isLive ? <span className="rounded-full bg-[#e24d4d] px-3 py-1 text-xs font-semibold text-white">ON AIR</span> : undefined}
      />

      <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-4">
          <PageSection>
            <PageSectionTitle eyebrow="Status" title="配信状態" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <PageMetric label="Live" value={config?.isLive ? 'ON' : 'OFF'} tone={config?.isLive ? 'accent' : 'soft'} />
              <PageMetric label="Requests" value={config?.requestsEnabled ? 'OPEN' : 'CLOSED'} />
            </div>
          </PageSection>

          <PageSection>
            <PageSectionTitle eyebrow="Requests" title="リクエスト" />
            {config?.requestsEnabled ? (
              <>
                <button
                  onClick={() => setShowRequestForm((prev) => !prev)}
                  className="inline-flex h-11 items-center justify-center rounded-[1rem] bg-white px-4 text-sm font-medium text-[#11161a]"
                >
                  {showRequestForm ? 'フォームを閉じる' : 'リクエストする'}
                </button>

                {showRequestForm ? (
                  <div className="mt-4 space-y-3 rounded-[1rem] bg-[#0f1418] p-4">
                    <input
                      type="text"
                      value={songTitle}
                      onChange={(event) => setSongTitle(event.target.value)}
                      className="h-11 w-full rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/28"
                      placeholder="曲名 *"
                    />
                    <input
                      type="text"
                      value={artist}
                      onChange={(event) => setArtist(event.target.value)}
                      className="h-11 w-full rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/28"
                      placeholder="アーティスト名"
                    />
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={3}
                      className="w-full rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none placeholder:text-white/28"
                      placeholder="メッセージ（任意）"
                    />
                    <button
                      onClick={handleSubmitRequest}
                      disabled={submitting || !songTitle}
                      className="inline-flex h-11 items-center justify-center rounded-[0.9rem] bg-[#d9e4dc] px-4 text-sm font-medium text-[#11161a] disabled:opacity-45"
                    >
                      {submitting ? '送信中...' : '送信'}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <PageEmptyState title="現在リクエストは受け付けていません" />
            )}
          </PageSection>

          {myRequests.length > 0 ? (
            <PageSection>
              <PageSectionTitle eyebrow="My Requests" title="あなたのリクエスト" />
              <div className="space-y-2">
                {myRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-[1rem] bg-[#0f1418] p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{req.songTitle}</p>
                      {req.artist ? <p className="mt-1 text-xs text-white/42">{req.artist}</p> : null}
                    </div>
                    <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs text-white/72">
                      {req.status === 'played' ? '再生済み' : req.status === 'approved' ? '承認済み' : req.status === 'rejected' ? '却下' : '申請中'}
                    </span>
                  </div>
                ))}
              </div>
            </PageSection>
          ) : null}
        </div>

        <div className="space-y-4">
          {config ? <RadioPlayer config={config} /> : null}
          {config ? <LiveReactions configDocPath="config/radio" isLive={config.isLive} /> : null}

          <PageSection>
            <PageSectionTitle eyebrow="Schedule" title="番組表" />
            {programs.length === 0 ? (
              <PageEmptyState title="番組が登録されていません" />
            ) : (
              <div className="space-y-2">
                {programs.map((program) => {
                  const isNow = isProgramNow(program)
                  return (
                    <div key={program.id} className={`rounded-[1rem] p-4 ${isNow ? 'bg-[#d9e4dc] text-[#11161a]' : 'bg-[#0f1418] text-white'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{program.title}</p>
                          {program.hosts?.length ? <p className={`mt-1 text-xs ${isNow ? 'text-[#11161a]/58' : 'text-white/42'}`}>パーソナリティ: {program.hosts.join(', ')}</p> : null}
                        </div>
                        {isNow ? <span className="rounded-full bg-[#11161a] px-2.5 py-1 text-[11px] font-semibold text-white">ON AIR</span> : null}
                      </div>
                      <p className={`mt-3 text-xs ${isNow ? 'text-[#11161a]/58' : 'text-white/42'}`}>
                        {formatTime(program.scheduledStart)} - {formatTime(program.scheduledEnd)}
                      </p>
                      {program.description ? <p className={`mt-2 text-sm ${isNow ? 'text-[#11161a]/72' : 'text-white/62'}`}>{program.description}</p> : null}
                    </div>
                  )
                })}
              </div>
            )}
          </PageSection>
        </div>
      </div>
    </UserPageShell>
  )
}
