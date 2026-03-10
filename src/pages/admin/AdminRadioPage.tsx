import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Toast, useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import type { RadioConfig, RadioProgram, RadioRequest } from '@/types/firestore'

type ProgramWithId = RadioProgram & { id: string }
type RequestWithId = RadioRequest & { id: string }

export default function AdminRadioPage() {
  useAuth() // Auth required
  const [config, setConfig] = useState<RadioConfig>({
    isLive: false,
    currentStreamUrl: '',
    streamType: 'youtube',
    requestsEnabled: false,
  })
  const [programs, setPrograms] = useState<ProgramWithId[]>([])
  const [requests, setRequests] = useState<RequestWithId[]>([])
  const [loading, setLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)
  const { toast, showToast, hideToast } = useToast()
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; onConfirm: () => void
  } | null>(null)

  // Program form
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null)
  const [programForm, setProgramForm] = useState({
    title: '',
    hosts: '',
    description: '',
    scheduledStart: '',
    scheduledEnd: '',
  })
  const [programSaving, setProgramSaving] = useState(false)

  // Fetch config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'config', 'radio'))
        if (configDoc.exists()) {
          setConfig(configDoc.data() as RadioConfig)
        }
      } catch (error) {
        console.error('Error fetching config:', error)
      }
    }

    fetchConfig()
  }, [])

  // Fetch programs and requests
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch programs
        const programsQuery = query(
          collection(db, 'radioPrograms'),
          orderBy('scheduledStart', 'asc')
        )
        const programsSnap = await getDocs(programsQuery)
        const programList: ProgramWithId[] = []
        programsSnap.forEach((doc) => {
          programList.push({ id: doc.id, ...doc.data() } as ProgramWithId)
        })
        setPrograms(programList)

        // Fetch requests
        const requestsQuery = query(
          collection(db, 'radioRequests'),
          orderBy('createdAt', 'desc')
        )
        const requestsSnap = await getDocs(requestsQuery)
        const requestList: RequestWithId[] = []
        requestsSnap.forEach((doc) => {
          requestList.push({ id: doc.id, ...doc.data() } as RequestWithId)
        })
        setRequests(requestList)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Save config
  const handleSaveConfig = async () => {
    setConfigSaving(true)
    try {
      await setDoc(doc(db, 'config', 'radio'), config)
      showToast('設定を保存しました', 'success')
    } catch (error) {
      console.error('Error saving config:', error)
      showToast('保存に失敗しました', 'error')
    } finally {
      setConfigSaving(false)
    }
  }

  // Save program
  const handleSaveProgram = async () => {
    if (!programForm.title || !programForm.scheduledStart || !programForm.scheduledEnd) {
      showToast('必須項目を入力してください', 'error')
      return
    }

    setProgramSaving(true)
    try {
      const programData = {
        title: programForm.title,
        hosts: programForm.hosts.split(',').map((h) => h.trim()).filter(Boolean),
        description: programForm.description || null,
        scheduledStart: Timestamp.fromDate(new Date(programForm.scheduledStart)),
        scheduledEnd: Timestamp.fromDate(new Date(programForm.scheduledEnd)),
      }

      const programId = editingProgramId || `program-${Date.now()}`
      await setDoc(doc(db, 'radioPrograms', programId), programData)

      // Update local state
      if (editingProgramId) {
        setPrograms((prev) =>
          prev.map((p) =>
            p.id === editingProgramId ? { ...p, ...programData, id: editingProgramId } as ProgramWithId : p
          )
        )
      } else {
        setPrograms((prev) =>
          [...prev, { ...programData, id: programId } as ProgramWithId].sort(
            (a, b) => a.scheduledStart.toDate().getTime() - b.scheduledStart.toDate().getTime()
          )
        )
      }

      setShowProgramForm(false)
      setEditingProgramId(null)
      setProgramForm({
        title: '',
        hosts: '',
        description: '',
        scheduledStart: '',
        scheduledEnd: '',
      })
      showToast(editingProgramId ? '番組を更新しました' : '番組を追加しました', 'success')
    } catch (error) {
      console.error('Error saving program:', error)
      showToast('保存に失敗しました', 'error')
    } finally {
      setProgramSaving(false)
    }
  }

  // Edit program
  const handleEditProgram = (program: ProgramWithId) => {
    setProgramForm({
      title: program.title,
      hosts: program.hosts?.join(', ') || '',
      description: program.description || '',
      scheduledStart: program.scheduledStart.toDate().toISOString().slice(0, 16),
      scheduledEnd: program.scheduledEnd.toDate().toISOString().slice(0, 16),
    })
    setEditingProgramId(program.id)
    setShowProgramForm(true)
  }

  // Delete program
  const handleDeleteProgram = (programId: string) => {
    setConfirmDialog({
      title: '番組削除',
      message: 'この番組を削除しますか？',
      onConfirm: async () => {
        setConfirmDialog(null)
        try {
          await deleteDoc(doc(db, 'radioPrograms', programId))
          setPrograms((prev) => prev.filter((p) => p.id !== programId))
          showToast('番組を削除しました', 'success')
        } catch (error) {
          console.error('Error deleting program:', error)
          showToast('削除に失敗しました', 'error')
        }
      },
    })
  }

  // Update request status
  const handleUpdateRequestStatus = async (
    requestId: string,
    status: 'approved' | 'played' | 'rejected'
  ) => {
    try {
      await updateDoc(doc(db, 'radioRequests', requestId), { status })
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r))
      )
    } catch (error) {
      console.error('Error updating request:', error)
      showToast('更新に失敗しました', 'error')
    }
  }

  // Delete request
  const handleDeleteRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'radioRequests', requestId))
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
    } catch (error) {
      console.error('Error deleting request:', error)
    }
  }

  const formatTime = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hatofes-bg">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        variant="danger"
        confirmLabel="削除"
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
      {/* Header */}
      <header className="bg-hatofes-dark border-b border-hatofes-gray-lighter px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-hatofes-gray hover:text-hatofes-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-hatofes-white font-display">
              📻 鳩ラジ管理
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Config Section */}
        <section className="card mb-8">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">配信設定</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isLive}
                  onChange={(e) => setConfig({ ...config, isLive: e.target.checked })}
                  className="w-5 h-5 rounded border-hatofes-gray bg-hatofes-dark text-red-500"
                />
                <span className="text-hatofes-white">ライブ配信中</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.requestsEnabled}
                  onChange={(e) => setConfig({ ...config, requestsEnabled: e.target.checked })}
                  className="w-5 h-5 rounded border-hatofes-gray bg-hatofes-dark text-hatofes-accent-yellow"
                />
                <span className="text-hatofes-white">リクエスト受付</span>
              </label>
            </div>

            <div>
              <label className="block text-sm text-hatofes-gray mb-2">配信タイプ</label>
              <select
                value={config.streamType}
                onChange={(e) =>
                  setConfig({ ...config, streamType: e.target.value as RadioConfig['streamType'] })
                }
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
              >
                <option value="youtube">YouTube Live</option>
                <option value="external">外部ストリーミング (Icecast/SHOUTcast)</option>
                <option value="archive">録音ファイル</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-hatofes-gray mb-2">配信URL</label>
              <input
                type="text"
                value={config.currentStreamUrl}
                onChange={(e) => setConfig({ ...config, currentStreamUrl: e.target.value })}
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                placeholder={
                  config.streamType === 'youtube'
                    ? 'https://www.youtube.com/watch?v=...'
                    : config.streamType === 'external'
                    ? 'https://stream.example.com/radio.mp3'
                    : 'https://example.com/archive.mp3'
                }
              />
            </div>

            <div>
              <label className="block text-sm text-hatofes-gray mb-2">お知らせメッセージ</label>
              <input
                type="text"
                value={config.announcement || ''}
                onChange={(e) => setConfig({ ...config, announcement: e.target.value })}
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                placeholder="例: 本日の放送は15時から！"
              />
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={configSaving}
              className="btn-main w-full py-2 disabled:opacity-50"
            >
              {configSaving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </section>

        {/* Programs Section */}
        <section className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-hatofes-white">番組表</h2>
            <button
              onClick={() => {
                setEditingProgramId(null)
                setProgramForm({
                  title: '',
                  hosts: '',
                  description: '',
                  scheduledStart: '',
                  scheduledEnd: '',
                })
                setShowProgramForm(!showProgramForm)
              }}
              className="btn-main text-sm px-4 py-2"
            >
              {showProgramForm ? '閉じる' : '+ 番組追加'}
            </button>
          </div>

          {showProgramForm && (
            <div className="bg-hatofes-dark p-4 rounded-lg mb-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">番組名 *</label>
                  <input
                    type="text"
                    value={programForm.title}
                    onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                    className="w-full bg-hatofes-bg border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">
                    パーソナリティ（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={programForm.hosts}
                    onChange={(e) => setProgramForm({ ...programForm, hosts: e.target.value })}
                    className="w-full bg-hatofes-bg border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                    placeholder="例: 山田太郎, 鈴木花子"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-hatofes-gray mb-2">開始日時 *</label>
                    <input
                      type="datetime-local"
                      value={programForm.scheduledStart}
                      onChange={(e) =>
                        setProgramForm({ ...programForm, scheduledStart: e.target.value })
                      }
                      className="w-full bg-hatofes-bg border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-hatofes-gray mb-2">終了日時 *</label>
                    <input
                      type="datetime-local"
                      value={programForm.scheduledEnd}
                      onChange={(e) =>
                        setProgramForm({ ...programForm, scheduledEnd: e.target.value })
                      }
                      className="w-full bg-hatofes-bg border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">説明</label>
                  <textarea
                    value={programForm.description}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, description: e.target.value })
                    }
                    rows={2}
                    className="w-full bg-hatofes-bg border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  />
                </div>
                <button
                  onClick={handleSaveProgram}
                  disabled={programSaving}
                  className="btn-main w-full py-2 disabled:opacity-50"
                >
                  {programSaving ? '保存中...' : editingProgramId ? '更新' : '追加'}
                </button>
              </div>
            </div>
          )}

          {programs.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">番組が登録されていません</p>
          ) : (
            <div className="space-y-3">
              {programs.map((program) => (
                <div
                  key={program.id}
                  className="flex items-center justify-between bg-hatofes-dark p-4 rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="text-hatofes-white font-medium">{program.title}</h3>
                    {program.hosts && program.hosts.length > 0 && (
                      <p className="text-sm text-hatofes-gray">{program.hosts.join(', ')}</p>
                    )}
                    <p className="text-xs text-hatofes-gray mt-1">
                      {formatTime(program.scheduledStart)} - {formatTime(program.scheduledEnd)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditProgram(program)}
                      className="p-2 text-hatofes-gray hover:text-hatofes-white"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(program.id)}
                      className="p-2 text-red-400 hover:text-red-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Requests Section */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">リクエスト一覧</h2>

          {requests.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">リクエストはありません</p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between bg-hatofes-dark p-4 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-hatofes-gray">{request.username}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          request.status === 'played'
                            ? 'bg-green-500/20 text-green-400'
                            : request.status === 'approved'
                            ? 'bg-blue-500/20 text-blue-400'
                            : request.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {request.status === 'played'
                          ? '再生済み'
                          : request.status === 'approved'
                          ? '承認済み'
                          : request.status === 'rejected'
                          ? '却下'
                          : '申請中'}
                      </span>
                    </div>
                    <p className="text-hatofes-white font-medium truncate">{request.songTitle}</p>
                    {request.artist && (
                      <p className="text-sm text-hatofes-gray truncate">{request.artist}</p>
                    )}
                    {request.message && (
                      <p className="text-xs text-hatofes-gray mt-1 italic">"{request.message}"</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    {request.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateRequestStatus(request.id, 'approved')}
                          className="p-2 text-green-400 hover:text-green-300"
                          title="承認"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleUpdateRequestStatus(request.id, 'rejected')}
                          className="p-2 text-red-400 hover:text-red-300"
                          title="却下"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <button
                        onClick={() => handleUpdateRequestStatus(request.id, 'played')}
                        className="p-2 text-blue-400 hover:text-blue-300"
                        title="再生済みにする"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteRequest(request.id)}
                      className="p-2 text-hatofes-gray hover:text-hatofes-white"
                      title="削除"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
