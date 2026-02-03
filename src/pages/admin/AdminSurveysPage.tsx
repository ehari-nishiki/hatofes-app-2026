import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'

interface Survey {
  id: string
  title: string
  description: string
  points: number
  status: 'active' | 'closed'
  createdAt: Timestamp
  responseCount?: number
}

interface NewSurvey {
  title: string
  description: string
  points: number
  questions: Array<{
    type: 'multiple_choice' | 'text' | 'rating'
    question: string
    options?: string[]
    required: boolean
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
    questions: [{ type: 'multiple_choice', question: '', options: ['', ''], required: true }],
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchSurveys()
  }, [])

  const fetchSurveys = async () => {
    try {
      const q = query(collection(db, 'surveys'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      const list: Survey[] = []

      for (const docSnap of snap.docs) {
        const data = docSnap.data()
        // Get response count
        const responsesSnap = await getDocs(
          query(collection(db, 'surveyResponses'))
        )
        const responseCount = responsesSnap.docs.filter(r => r.data().surveyId === docSnap.id).length

        list.push({
          id: docSnap.id,
          title: data.title,
          description: data.description,
          points: data.points,
          status: data.status,
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
        questions: newSurvey.questions,
        status: 'active',
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        createdBy: currentUser?.uid,
        createdAt: Timestamp.now(),
      })

      setMessage({ type: 'success', text: 'アンケートを作成しました' })
      setShowCreate(false)
      setNewSurvey({ title: '', description: '', points: 10, questions: [{ type: 'multiple_choice', question: '', options: ['', ''], required: true }] })
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-hatofes-card rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                    <div key={i} className="bg-hatofes-dark p-3 rounded-lg mb-2">
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
                      {q.type === 'multiple_choice' && (
                        <div className="space-y-1">
                          {q.options?.map((opt, j) => (
                            <input
                              key={j}
                              type="text"
                              value={opt}
                              onChange={e => {
                                const options = [...(q.options || [])]
                                options[j] = e.target.value
                                updateQuestion(i, 'options', options)
                              }}
                              placeholder={`選択肢 ${j + 1}`}
                              className="w-full bg-hatofes-bg border border-hatofes-gray rounded px-2 py-1 text-hatofes-white text-sm"
                            />
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-hatofes-white font-medium">{survey.title}</h3>
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
      </main>
    </div>
  )
}
