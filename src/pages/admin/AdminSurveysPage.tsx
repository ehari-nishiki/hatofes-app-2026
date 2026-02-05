import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, Timestamp, query, orderBy, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { ImageUploader } from '@/components/ui/ImageUploader'

interface Survey {
  id: string
  title: string
  description: string
  points: number
  status: 'active' | 'closed'
  category?: 'task' | 'mission'
  createdAt: Timestamp
  responseCount?: number
}

interface NewSurvey {
  title: string
  description: string
  points: number
  category: 'task' | 'mission'
  questions: Array<{
    type: 'multiple_choice' | 'text' | 'rating'
    question: string
    options?: string[]
    required: boolean
    imageUrl?: string
  }>
}

export default function AdminSurveysPage() {
  const { currentUser } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newSurvey, setNewSurvey] = useState<NewSurvey>({
    title: '',
    description: '',
    points: 10,
    category: 'task',
    questions: [{ type: 'multiple_choice', question: '', options: ['', ''], required: true }],
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Google Sheets config
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetSaving, setSheetSaving] = useState(false)

  // Response viewing modal
  const [viewingSurvey, setViewingSurvey] = useState<Survey | null>(null)
  const [responses, setResponses] = useState<Array<{ id: string; userId: string; username: string; answers: unknown[] }>>([])
  const [responsesLoading, setResponsesLoading] = useState(false)
  const [surveyQuestions, setSurveyQuestions] = useState<Array<{ id: string; question: string; type: string }>>([])

  const handleViewResponses = async (survey: Survey) => {
    setViewingSurvey(survey)
    setResponsesLoading(true)
    try {
      // Fetch questions from the survey document
      const surveySnap = await getDoc(doc(db, 'surveys', survey.id))
      if (surveySnap.exists()) {
        setSurveyQuestions(surveySnap.data().questions || [])
      }

      // Fetch responses for this survey
      const responsesSnap = await getDocs(
        query(collection(db, 'surveyResponses'), where('surveyId', '==', survey.id))
      )

      // Fetch usernames
      const responseList: Array<{ id: string; userId: string; username: string; answers: unknown[] }> = []
      for (const respDoc of responsesSnap.docs) {
        const data = respDoc.data()
        let username = data.userId
        try {
          const userSnap = await getDoc(doc(db, 'users', data.userId))
          if (userSnap.exists()) {
            username = userSnap.data().username
          }
        } catch { /* fallback to userId */ }
        responseList.push({
          id: respDoc.id,
          userId: data.userId,
          username,
          answers: data.answers,
        })
      }
      setResponses(responseList)
    } catch (error) {
      console.error('Error fetching responses:', error)
    } finally {
      setResponsesLoading(false)
    }
  }

  useEffect(() => {
    fetchSurveys()
  }, [])

  useEffect(() => {
    const loadSheetConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'sheetSync'))
        if (snap.exists()) {
          setSheetUrl(snap.data().sheetUrl || '')
        }
      } catch (err) { console.error('Failed to load sheet config:', err) }
    }
    loadSheetConfig()
  }, [])

  const fetchSurveys = async () => {
    try {
      const q = query(collection(db, 'surveys'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      const list: Survey[] = []

      for (const docSnap of snap.docs) {
        const data = docSnap.data()
        // Get response count for this survey
        const responsesSnap = await getDocs(
          query(collection(db, 'surveyResponses'), where('surveyId', '==', docSnap.id))
        )
        const responseCount = responsesSnap.size

        list.push({
          id: docSnap.id,
          title: data.title,
          description: data.description,
          points: data.points,
          status: data.status,
          category: data.category,
          createdAt: data.createdAt,
          responseCount,
        })
      }
      setSurveys(list)
    } catch (error) {
      console.error('Error fetching surveys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSurvey = async () => {
    if (!newSurvey.title || newSurvey.questions.length === 0) return

    setSubmitting(true)
    try {
      const surveyId = `survey-${Date.now()}`
      await setDoc(doc(db, 'surveys', surveyId), {
        title: newSurvey.title,
        description: newSurvey.description,
        points: newSurvey.points,
        category: newSurvey.category,
        questions: newSurvey.questions.map((q, i) => ({ ...q, id: `q-${i}` })),
        status: 'active',
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        createdBy: currentUser?.uid,
        createdAt: Timestamp.now(),
      })

      setMessage({ type: 'success', text: 'アンケートを作成しました' })
      setShowCreate(false)
      setNewSurvey({ title: '', description: '', points: 10, category: 'task', questions: [{ type: 'multiple_choice', question: '', options: ['', ''], required: true }] })
      fetchSurveys()
    } catch (error) {
      console.error('Error creating survey:', error)
      setMessage({ type: 'error', text: 'アンケート作成に失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (survey: Survey) => {
    try {
      await updateDoc(doc(db, 'surveys', survey.id), {
        status: survey.status === 'active' ? 'closed' : 'active',
      })
      fetchSurveys()
    } catch (error) {
      console.error('Error toggling status:', error)
    }
  }

  const handleDelete = async (surveyId: string) => {
    if (!confirm('このアンケートを削除しますか？')) return

    try {
      await deleteDoc(doc(db, 'surveys', surveyId))
      fetchSurveys()
    } catch (error) {
      console.error('Error deleting survey:', error)
    }
  }

  const handleSaveSheetConfig = async () => {
    setSheetSaving(true)
    try {
      const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
      const sheetId = match ? match[1] : sheetUrl
      await setDoc(doc(db, 'config', 'sheetSync'), { sheetUrl, sheetId })
      setMessage({ type: 'success', text: 'スプレッドシート設定を保存しました' })
    } catch (err) {
      console.error('Failed to save sheet config:', err)
      setMessage({ type: 'error', text: '設定の保存に失敗しました' })
    } finally {
      setSheetSaving(false)
    }
  }

  const addQuestion = () => {
    setNewSurvey(prev => ({
      ...prev,
      questions: [...prev.questions, { type: 'multiple_choice', question: '', options: ['', ''], required: true }],
    }))
  }

  const updateQuestion = (index: number, field: string, value: unknown) => {
    setNewSurvey(prev => {
      const questions = [...prev.questions]
      questions[index] = { ...questions[index], [field]: value }
      return { ...prev, questions }
    })
  }

  const addOption = (questionIndex: number) => {
    setNewSurvey(prev => {
      const questions = [...prev.questions]
      questions[questionIndex].options = [...(questions[questionIndex].options || []), '']
      return { ...prev, questions }
    })
  }

  return (
    <div className="min-h-screen bg-hatofes-bg">
      {/* Header */}
      <header className="bg-hatofes-dark border-b border-hatofes-gray-lighter px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-hatofes-gray hover:text-hatofes-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="font-display text-xl font-bold text-hatofes-white">アンケート管理</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-main text-sm px-4 py-2">
            新規作成
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Create Form Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-hatofes-dark rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-hatofes-gray">
              <h2 className="text-lg font-bold text-hatofes-white mb-4">アンケートを作成</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">タイトル</label>
                  <input
                    type="text"
                    value={newSurvey.title}
                    onChange={e => setNewSurvey(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">説明</label>
                  <textarea
                    value={newSurvey.description}
                    onChange={e => setNewSurvey(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">カテゴリ</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                      newSurvey.category === 'task'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                        : 'bg-hatofes-dark border-hatofes-gray text-hatofes-gray hover:border-hatofes-gray-light'
                    }`}>
                      <input
                        type="radio"
                        name="category"
                        value="task"
                        checked={newSurvey.category === 'task'}
                        onChange={() => setNewSurvey(prev => ({ ...prev, category: 'task' }))}
                        className="sr-only"
                      />
                      <span className="font-medium">タスク</span>
                      <span className="text-xs">(全員対象)</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                      newSurvey.category === 'mission'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                        : 'bg-hatofes-dark border-hatofes-gray text-hatofes-gray hover:border-hatofes-gray-light'
                    }`}>
                      <input
                        type="radio"
                        name="category"
                        value="mission"
                        checked={newSurvey.category === 'mission'}
                        onChange={() => setNewSurvey(prev => ({ ...prev, category: 'mission' }))}
                        className="sr-only"
                      />
                      <span className="font-medium">ミッション</span>
                      <span className="text-xs">(任意参加)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">完答時ポイント</label>
                  <input
                    type="number"
                    value={newSurvey.points}
                    onChange={e => setNewSurvey(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                    className="w-32 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">質問</label>
                  {newSurvey.questions.map((q, i) => (
                    <div key={i} className="bg-hatofes-dark p-3 rounded-lg mb-2 relative">
                      {/* Delete question button */}
                      {newSurvey.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewSurvey(prev => ({
                              ...prev,
                              questions: prev.questions.filter((_, idx) => idx !== i)
                            }))
                          }}
                          className="absolute top-2 right-2 text-red-400 hover:text-red-300 p-1"
                          title="質問を削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-hatofes-gray">Q{i + 1}</span>
                      </div>
                      <input
                        type="text"
                        value={q.question}
                        onChange={e => updateQuestion(i, 'question', e.target.value)}
                        placeholder="質問文"
                        className="w-full bg-hatofes-bg border border-hatofes-gray rounded px-2 py-1 text-hatofes-white mb-2"
                      />
                      <select
                        value={q.type}
                        onChange={e => updateQuestion(i, 'type', e.target.value)}
                        className="bg-hatofes-bg border border-hatofes-gray rounded px-2 py-1 text-hatofes-white text-sm mb-2"
                      >
                        <option value="multiple_choice">選択式</option>
                        <option value="text">テキスト</option>
                        <option value="rating">評価（5段階）</option>
                      </select>
                      <ImageUploader
                        imageUrl={q.imageUrl || ''}
                        onChange={url => updateQuestion(i, 'imageUrl', url)}
                        label="質問画像"
                      />
                      {q.type === 'multiple_choice' && (
                        <div className="space-y-1">
                          {q.options?.map((opt, j) => (
                            <div key={j} className="flex items-center gap-1">
                              <input
                                type="text"
                                value={opt}
                                onChange={e => {
                                  const options = [...(q.options || [])]
                                  options[j] = e.target.value
                                  updateQuestion(i, 'options', options)
                                }}
                                placeholder={`選択肢 ${j + 1}`}
                                className="flex-1 bg-hatofes-bg border border-hatofes-gray rounded px-2 py-1 text-hatofes-white text-sm"
                              />
                              {(q.options?.length || 0) > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const options = [...(q.options || [])].filter((_, idx) => idx !== j)
                                    updateQuestion(i, 'options', options)
                                  }}
                                  className="text-red-400 hover:text-red-300 p-1"
                                  title="選択肢を削除"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => addOption(i)} className="text-xs text-hatofes-accent-yellow">
                            + 選択肢を追加
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={addQuestion} className="text-sm text-hatofes-accent-yellow">
                    + 質問を追加
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowCreate(false)} className="btn-sub flex-1 py-2">
                  キャンセル
                </button>
                <button onClick={handleCreateSurvey} disabled={submitting} className="btn-main flex-1 py-2">
                  {submitting ? '作成中...' : '作成'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Survey List */}
        <div className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">アンケート一覧</h2>

          {loading ? (
            <p className="text-hatofes-gray text-center py-4">読み込み中...</p>
          ) : surveys.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">アンケートがありません</p>
          ) : (
            <div className="space-y-3">
              {surveys.map(survey => (
                <div key={survey.id} className="bg-hatofes-dark p-4 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-hatofes-white font-medium">{survey.title}</h3>
                        {survey.category && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            survey.category === 'task'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {survey.category === 'task' ? 'タスク' : 'ミッション'}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          survey.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {survey.status === 'active' ? '公開中' : '終了'}
                        </span>
                      </div>
                      <p className="text-sm text-hatofes-gray mt-1">{survey.description}</p>
                      <p className="text-xs text-hatofes-gray mt-2">
                        {survey.points}pt / 回答数: {survey.responseCount || 0}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewResponses(survey)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        回答閲覧
                      </button>
                      <button
                        onClick={() => handleToggleStatus(survey)}
                        className="text-xs text-hatofes-gray hover:text-hatofes-white"
                      >
                        {survey.status === 'active' ? '終了' : '再開'}
                      </button>
                      <button
                        onClick={() => handleDelete(survey.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Google Sheets 同期設定 */}
        <div className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-2">Google Sheets 同期設定</h2>
          <p className="text-xs text-hatofes-gray mb-4">
            アンケート回答が自動で書き込まれるスプレッドシートのURLを設定します。
            シートにサービスアカウントを編集権限で共有する必要があります。
            サービスアカウントキーは <code className="text-hatofes-accent-yellow text-xs">firebase functions:secrets:set GOOGLE_SHEETS_KEY</code> で設定してください。
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-hatofes-gray mb-1">スプレッドシートURL</label>
              <input
                type="text"
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white placeholder-hatofes-gray text-sm"
              />
            </div>
            <button
              onClick={handleSaveSheetConfig}
              disabled={sheetSaving || !sheetUrl}
              className="btn-main w-full py-2 disabled:opacity-50"
            >
              {sheetSaving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>

        {/* Response Viewing Modal */}
        {viewingSurvey && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-hatofes-dark rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-hatofes-gray">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-hatofes-white">「{viewingSurvey.title}」の回答</h2>
                <button onClick={() => setViewingSurvey(null)} className="text-hatofes-gray hover:text-hatofes-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {responsesLoading ? (
                <div className="flex justify-center py-8"><Spinner size="lg" /></div>
              ) : responses.length === 0 ? (
                <p className="text-hatofes-gray text-center py-4">回答はありません</p>
              ) : (
                <div className="space-y-4">
                  {responses.map((resp) => (
                    <div key={resp.id} className="bg-hatofes-bg p-4 rounded-lg">
                      <p className="text-sm text-hatofes-accent-yellow font-bold mb-2">{resp.username}</p>
                      <div className="space-y-2">
                        {surveyQuestions.map((q, i) => {
                          const answer = Array.isArray(resp.answers)
                            ? resp.answers.find((a: unknown) => typeof a === 'object' && a !== null && 'questionId' in a && (a as { questionId: string }).questionId === q.id)
                            : null;
                          const answerValue = answer && typeof answer === 'object' && 'value' in answer ? String((answer as { value: unknown }).value) : '−';
                          return (
                            <div key={q.id}>
                              <p className="text-xs text-hatofes-gray">Q{i + 1}: {q.question}</p>
                              <p className="text-sm text-hatofes-white">{answerValue}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
