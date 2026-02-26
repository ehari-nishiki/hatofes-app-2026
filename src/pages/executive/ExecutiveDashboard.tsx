import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  query,
  orderBy,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  limit,
  deleteDoc,
  arrayUnion,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import AppHeader from '@/components/layout/AppHeader'
import { QAIcon } from '@/components/ui/Icon'
import type { ExecutiveConfig } from '@/types/firestore'

interface Answer {
  id: string
  text: string
  answeredBy: string
  answeredByName: string
  answeredAt: Timestamp
}

interface Question {
  id: string
  question: string
  submittedBy: string
  submittedByName: string
  submittedAt: Timestamp
  // Legacy single answer (for backwards compatibility)
  answer?: string
  answeredBy?: string
  answeredByName?: string
  answeredAt?: Timestamp
  // New multiple answers
  answers?: Answer[]
  isPinned?: boolean
  likes: number
  likedBy: string[]
  status: 'pending' | 'answered'
}

export default function ExecutiveDashboard() {
  const { currentUser, userData } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isExecutive, setIsExecutive] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'answered' | 'pending'>('answered')
  const [answerText, setAnswerText] = useState('')
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [editingAnswer, setEditingAnswer] = useState<{ questionId: string; answerId: string; text: string } | null>(null)
  const [executiveNames, setExecutiveNames] = useState<string[]>([])

  // Check if user is executive
  useEffect(() => {
    const checkExecutive = async () => {
      if (!currentUser || !userData) return

      try {
        const configDoc = await getDoc(doc(db, 'config', 'executiveAccess'))
        if (configDoc.exists()) {
          const config = configDoc.data() as ExecutiveConfig
          if (config.executiveUserIds?.includes(currentUser.uid)) {
            setIsExecutive(true)
          }
          // Get executive names for display
          if (config.executiveNames) {
            setExecutiveNames(config.executiveNames)
          }
        }
        // Admin also counts as executive
        if (userData.role === 'admin') {
          setIsExecutive(true)
        }
      } catch (error) {
        console.error('Error checking executive status:', error)
      } finally {
        setLoading(false)
      }
    }

    checkExecutive()
  }, [currentUser, userData])

  // Fetch questions
  useEffect(() => {
    const q = query(
      collection(db, 'executiveQA'),
      orderBy('submittedAt', 'desc'),
      limit(50)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const questionList: Question[] = []
      snapshot.forEach((doc) => {
        questionList.push({ id: doc.id, ...doc.data() } as Question)
      })
      setQuestions(questionList)
    })

    return () => unsubscribe()
  }, [])

  // Submit new question
  const handleSubmitQuestion = async () => {
    if (!currentUser || !userData || !newQuestion.trim()) return

    setSubmitting(true)
    try {
      await addDoc(collection(db, 'executiveQA'), {
        question: newQuestion.trim(),
        submittedBy: currentUser.uid,
        submittedByName: userData.username,
        submittedAt: Timestamp.now(),
        status: 'pending',
        likes: 0,
        likedBy: [],
        isPinned: false,
      })
      setNewQuestion('')
    } catch (error) {
      console.error('Error submitting question:', error)
      alert('質問の送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  // Answer question (executives only) - supports multiple answers
  const handleAnswerQuestion = async (questionId: string) => {
    if (!currentUser || !userData || !answerText.trim() || !isExecutive) return

    const newAnswer: Answer = {
      id: `ans-${Date.now()}`,
      text: answerText.trim(),
      answeredBy: currentUser.uid,
      answeredByName: userData.realName || userData.username,
      answeredAt: Timestamp.now(),
    }

    try {
      await updateDoc(doc(db, 'executiveQA', questionId), {
        answers: arrayUnion(newAnswer),
        status: 'answered',
      })
      setAnswerText('')
      setAnsweringId(null)
    } catch (error) {
      console.error('Error answering question:', error)
      alert('回答の送信に失敗しました')
    }
  }

  // Edit answer (executives only)
  const handleEditAnswer = async () => {
    if (!editingAnswer || !isExecutive) return

    const question = questions.find(q => q.id === editingAnswer.questionId)
    if (!question) return

    // Update the specific answer in the answers array
    const updatedAnswers = (question.answers || []).map(a =>
      a.id === editingAnswer.answerId
        ? { ...a, text: editingAnswer.text }
        : a
    )

    try {
      await updateDoc(doc(db, 'executiveQA', editingAnswer.questionId), {
        answers: updatedAnswers,
      })
      setEditingAnswer(null)
    } catch (error) {
      console.error('Error editing answer:', error)
      alert('回答の編集に失敗しました')
    }
  }

  // Delete answer (executives only)
  const handleDeleteAnswer = async (questionId: string, answerId: string) => {
    if (!isExecutive || !confirm('この回答を削除しますか？')) return

    const question = questions.find(q => q.id === questionId)
    if (!question) return

    const updatedAnswers = (question.answers || []).filter(a => a.id !== answerId)

    try {
      await updateDoc(doc(db, 'executiveQA', questionId), {
        answers: updatedAnswers,
        status: updatedAnswers.length > 0 ? 'answered' : 'pending',
      })
    } catch (error) {
      console.error('Error deleting answer:', error)
    }
  }

  // Like a question
  const handleLike = async (questionId: string) => {
    if (!currentUser) return

    const question = questions.find(q => q.id === questionId)
    if (!question) return

    const hasLiked = question.likedBy.includes(currentUser.uid)

    try {
      await updateDoc(doc(db, 'executiveQA', questionId), {
        likes: hasLiked ? question.likes - 1 : question.likes + 1,
        likedBy: hasLiked
          ? question.likedBy.filter(id => id !== currentUser.uid)
          : [...question.likedBy, currentUser.uid],
      })
    } catch (error) {
      console.error('Error liking question:', error)
    }
  }

  // Pin/Unpin question (executives only)
  const handleTogglePin = async (questionId: string, isPinned: boolean) => {
    if (!isExecutive) return

    try {
      await updateDoc(doc(db, 'executiveQA', questionId), {
        isPinned: !isPinned,
      })
    } catch (error) {
      console.error('Error toggling pin:', error)
    }
  }

  // Delete question (executives only)
  const handleDelete = async (questionId: string) => {
    if (!isExecutive || !confirm('この質問を削除しますか？')) return

    try {
      await deleteDoc(doc(db, 'executiveQA', questionId))
    } catch (error) {
      console.error('Error deleting question:', error)
    }
  }

  const answeredQuestions = questions.filter(q => q.status === 'answered')
  const pendingQuestions = questions.filter(q => q.status === 'pending')

  // Sort: pinned first, then by likes
  const sortedAnsweredQuestions = [...answeredQuestions].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return b.likes - a.likes
  })

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return ''
    const date = timestamp.toDate()
    return `${date.getMonth() + 1}/${date.getDate()}`
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
        grade={userData?.grade || 1}
        classNumber={userData?.class || 'A'}
      />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header Banner */}
        <section className="card bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border-purple-500/30">
          <div className="text-center py-4">
            <div className="flex justify-center mb-2">
              <QAIcon size={48} gradient={false} color="#A855F7" />
            </div>
            <h1 className="font-display text-xl font-bold text-hatofes-white mb-1">
              三役Q&Aコーナー
            </h1>
            <p className="text-sm text-hatofes-gray">
              鳩祭三役があなたの質問に答えます！
            </p>
            {executiveNames.length > 0 && (
              <p className="text-xs text-purple-300 mt-2">
                回答者: {executiveNames.join('・')}
              </p>
            )}
          </div>
        </section>

        {/* Question Form */}
        <section className="card">
          <h2 className="font-bold text-hatofes-white mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-hatofes-accent-yellow" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            質問を投稿する
          </h2>
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="三役に聞きたいことを書いてね！（例：文化祭の見どころは？）"
            rows={3}
            className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-3 text-hatofes-white resize-none mb-3"
            maxLength={200}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-hatofes-gray">{newQuestion.length}/200</span>
            <button
              onClick={handleSubmitQuestion}
              disabled={submitting || !newQuestion.trim()}
              className="btn-main px-6 py-2 disabled:opacity-50"
            >
              {submitting ? '送信中...' : '質問する'}
            </button>
          </div>
        </section>

        {/* Executive Controls */}
        {isExecutive && (
          <section className="card border-2 border-purple-500/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-purple-300 flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                三役メニュー
              </h2>
              <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-1 rounded-full">
                未回答: {pendingQuestions.length}件
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('answered')}
                className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === 'answered'
                    ? 'bg-hatofes-accent-yellow text-black font-bold'
                    : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
                }`}
              >
                回答済み ({answeredQuestions.length})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-hatofes-accent-yellow text-black font-bold'
                    : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
                }`}
              >
                未回答 ({pendingQuestions.length})
              </button>
            </div>
          </section>
        )}

        {/* Questions List */}
        <section className="space-y-4">
          <h2 className="font-bold text-hatofes-white flex items-center gap-2">
            <svg className="w-5 h-5 text-hatofes-accent-yellow" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            {isExecutive && activeTab === 'pending' ? '未回答の質問' : 'みんなのQ&A'}
          </h2>

          {/* Show pending questions for executives */}
          {isExecutive && activeTab === 'pending' && (
            pendingQuestions.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-hatofes-gray">未回答の質問はありません</p>
              </div>
            ) : (
              pendingQuestions.map((q) => (
                <div key={q.id} className="card border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">❓</span>
                    <div className="flex-1">
                      <p className="text-hatofes-white mb-2">{q.question}</p>
                      <div className="flex items-center gap-3 text-xs text-hatofes-gray">
                        <span>{q.submittedByName}</span>
                        <span>{formatDate(q.submittedAt)}</span>
                        <button
                          onClick={() => handleLike(q.id)}
                          className={`flex items-center gap-1 ${
                            q.likedBy.includes(currentUser?.uid || '') ? 'text-red-400' : ''
                          }`}
                        >
                          ❤️ {q.likes}
                        </button>
                      </div>

                      {/* Answer Form */}
                      {answeringId === q.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="回答を入力..."
                            rows={3}
                            className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white text-sm resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAnswerQuestion(q.id)}
                              disabled={!answerText.trim()}
                              className="btn-main text-sm px-4 py-1.5 disabled:opacity-50"
                            >
                              回答する
                            </button>
                            <button
                              onClick={() => { setAnsweringId(null); setAnswerText(''); }}
                              className="btn-sub text-sm px-4 py-1.5"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => setAnsweringId(q.id)}
                            className="btn-main text-sm px-4 py-1.5"
                          >
                            回答する
                          </button>
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="text-red-400 text-sm px-3 py-1.5 hover:bg-red-500/10 rounded-lg"
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {/* Show answered questions */}
          {(!isExecutive || activeTab === 'answered') && (
            sortedAnsweredQuestions.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-hatofes-gray">まだ回答がありません</p>
                <p className="text-xs text-hatofes-gray mt-1">質問を投稿して待ってみてね！</p>
              </div>
            ) : (
              sortedAnsweredQuestions.map((q) => (
                <div
                  key={q.id}
                  className={`card ${q.isPinned ? 'border-2 border-hatofes-accent-yellow' : ''}`}
                >
                  {q.isPinned && (
                    <div className="text-xs text-hatofes-accent-yellow mb-2 flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z"/></svg>
                      ピン留め
                    </div>
                  )}

                  {/* Question */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-xl bg-blue-500/20 rounded-full w-8 h-8 flex items-center justify-center font-bold text-blue-300">Q</span>
                    <div className="flex-1">
                      <p className="text-hatofes-white">{q.question}</p>
                      <div className="flex items-center gap-3 text-xs text-hatofes-gray mt-1">
                        <span>{q.submittedByName}</span>
                        <span>{formatDate(q.submittedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Answers - support multiple answers */}
                  <div className="space-y-3 ml-4">
                    {/* Legacy single answer (backwards compatibility) */}
                    {q.answer && !q.answers?.length && (
                      <div className="flex items-start gap-3 pl-2 border-l-2 border-purple-500/50">
                        <span className="text-xl bg-purple-500/20 rounded-full w-8 h-8 flex items-center justify-center font-bold text-purple-300">A</span>
                        <div className="flex-1">
                          <p className="text-hatofes-white">{q.answer}</p>
                          <div className="flex items-center gap-3 text-xs text-hatofes-gray mt-1">
                            <span className="text-purple-300">{q.answeredByName}</span>
                            <span>{formatDate(q.answeredAt)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Multiple answers */}
                    {q.answers?.map((ans, idx) => (
                      <div key={ans.id} className="flex items-start gap-3 pl-2 border-l-2 border-purple-500/50">
                        <span className="text-lg bg-purple-500/20 rounded-full w-8 h-8 flex items-center justify-center font-bold text-purple-300">A{q.answers!.length > 1 ? idx + 1 : ''}</span>
                        <div className="flex-1">
                          {editingAnswer?.answerId === ans.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingAnswer.text}
                                onChange={(e) => setEditingAnswer({ ...editingAnswer, text: e.target.value })}
                                rows={3}
                                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white text-sm resize-none"
                              />
                              <div className="flex gap-2">
                                <button onClick={handleEditAnswer} className="btn-main text-sm px-4 py-1.5">保存</button>
                                <button onClick={() => setEditingAnswer(null)} className="btn-sub text-sm px-4 py-1.5">キャンセル</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-hatofes-white">{ans.text}</p>
                              <div className="flex items-center gap-3 text-xs text-hatofes-gray mt-1">
                                <span className="text-purple-300">{ans.answeredByName}</span>
                                <span>{formatDate(ans.answeredAt)}</span>
                                {isExecutive && (
                                  <>
                                    <button
                                      onClick={() => setEditingAnswer({ questionId: q.id, answerId: ans.id, text: ans.text })}
                                      className="text-hatofes-accent-yellow hover:underline"
                                    >
                                      編集
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAnswer(q.id, ans.id)}
                                      className="text-red-400 hover:underline"
                                    >
                                      削除
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Add another answer button for executives */}
                    {isExecutive && (
                      answeringId === q.id ? (
                        <div className="ml-10 mt-2 space-y-2">
                          <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="追加の回答を入力..."
                            rows={3}
                            className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white text-sm resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAnswerQuestion(q.id)}
                              disabled={!answerText.trim()}
                              className="btn-main text-sm px-4 py-1.5 disabled:opacity-50"
                            >
                              回答を追加
                            </button>
                            <button
                              onClick={() => { setAnsweringId(null); setAnswerText(''); }}
                              className="btn-sub text-sm px-4 py-1.5"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAnsweringId(q.id)}
                          className="ml-10 text-sm text-purple-300 hover:text-purple-200 flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                          回答を追加
                        </button>
                      )
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-hatofes-gray/20">
                    <button
                      onClick={() => handleLike(q.id)}
                      className={`flex items-center gap-1 text-sm transition-colors ${
                        q.likedBy.includes(currentUser?.uid || '')
                          ? 'text-red-400'
                          : 'text-hatofes-gray hover:text-red-400'
                      }`}
                    >
                      ❤️ {q.likes}
                    </button>

                    {isExecutive && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTogglePin(q.id, q.isPinned || false)}
                          className="text-xs text-hatofes-gray hover:text-hatofes-accent-yellow"
                        >
                          {q.isPinned ? 'ピン解除' : 'ピン留め'}
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )
          )}
        </section>

        {/* Back to Home */}
        <Link
          to="/home"
          className="block text-center py-3 text-hatofes-gray hover:text-hatofes-white transition-colors"
        >
          ← ホームに戻る
        </Link>
      </main>
    </div>
  )
}
