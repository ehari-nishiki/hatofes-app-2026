import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { getSurveyById, checkAlreadyAnswered, submitSurveyResponse } from '@/lib/surveyService'
import { PointRewardModal } from '@/components/ui/PointRewardModal'
import type { Survey, Answer, Question } from '@/types/firestore'

export default function SurveyDetailPage() {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const { currentUser, userData } = useAuth()

  const [survey, setSurvey] = useState<(Survey & { id: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAnswered, setIsAnswered] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRewardModal, setShowRewardModal] = useState(false)

  useEffect(() => {
    const fetchSurvey = async () => {
      if (!surveyId || !currentUser) return

      try {
        const [surveyData, answered] = await Promise.all([
          getSurveyById(surveyId),
          checkAlreadyAnswered(currentUser.uid, surveyId),
        ])

        setSurvey(surveyData)
        setIsAnswered(answered)
      } catch (error) {
        console.error('Error fetching survey:', error)
        setError('アンケートの読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchSurvey()
  }, [surveyId, currentUser])

  const handleAnswerChange = (questionId: string, value: string | number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    if (!survey || !currentUser) return

    // Validate required questions
    const unansweredRequired = survey.questions.filter(
      (q) => q.required && !answers[q.id]
    )

    if (unansweredRequired.length > 0) {
      setError('必須項目にすべて回答してください')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const formattedAnswers: Answer[] = Object.entries(answers).map(
        ([questionId, value]) => ({
          questionId,
          value,
        })
      )

      const result = await submitSurveyResponse(
        currentUser.uid,
        survey.id,
        formattedAnswers,
        survey.points
      )

      if (result.success) {
        setShowRewardModal(true)
      } else {
        setError(result.message)
      }
    } catch (error) {
      console.error('Error submitting survey:', error)
      setError('回答の送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRewardModalClose = () => {
    setShowRewardModal(false)
    // Navigate back based on survey category
    if (survey?.category === 'mission') {
      navigate('/missions')
    } else {
      navigate('/tasks')
    }
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hatofes-bg">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-hatofes-white">読み込み中...</div>
        </div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-hatofes-bg">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />
        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="card">
            <p className="text-hatofes-gray text-center py-4">アンケートが見つかりません</p>
          </div>
          <Link to="/home" className="block mt-6">
            <div className="btn-sub w-full py-3 text-center">
              ホームに戻る
            </div>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <>
      <PointRewardModal
        isOpen={showRewardModal}
        points={survey.points}
        reason="アンケート回答完了"
        onClose={handleRewardModalClose}
      />

      <div className="min-h-screen bg-hatofes-bg pb-8">
        <AppHeader
          username={userData.username}
          grade={userData.grade}
          classNumber={userData.class}
        />

        <main className="max-w-lg mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded ${
                survey.category === 'task'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                {survey.category === 'task' ? 'タスク' : 'ミッション'}
              </span>
              <span className="point-badge">{survey.points}pt</span>
            </div>
            <h1 className="text-xl font-bold text-hatofes-white">{survey.title}</h1>
            {survey.description && (
              <p className="text-sm text-hatofes-gray mt-2">{survey.description}</p>
            )}
          </div>

          {/* Already Answered State */}
          {isAnswered ? (
            <div className="card">
              <div className="text-center py-8">
                <div className="text-4xl mb-4">✅</div>
                <h2 className="text-lg font-bold text-hatofes-white mb-2">回答済み</h2>
                <p className="text-hatofes-gray">
                  このアンケートは既に回答済みです。<br />
                  ポイントは付与されています。
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Questions */}
              <div className="space-y-4">
                {survey.questions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    value={answers[question.id]}
                    onChange={(value) => handleAnswerChange(question.id, value)}
                  />
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-main w-full mt-6 py-3 text-lg"
              >
                {submitting ? '送信中...' : `回答を送信して ${survey.points}pt 獲得`}
              </button>
            </>
          )}

          {/* Back Button */}
          <Link to={survey.category === 'mission' ? '/missions' : '/tasks'} className="block mt-6">
            <div className="btn-sub w-full py-3 text-center">
              一覧に戻る
            </div>
          </Link>
        </main>
      </div>
    </>
  )
}

// Question Card Component
interface QuestionCardProps {
  question: Question
  index: number
  value: string | number | undefined
  onChange: (value: string | number) => void
}

function QuestionCard({ question, index, value, onChange }: QuestionCardProps) {
  return (
    <div className="card">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs bg-hatofes-dark px-2 py-1 rounded text-hatofes-gray">
          Q{index + 1}
        </span>
        {question.required && (
          <span className="text-xs text-red-400">必須</span>
        )}
      </div>
      <h3 className="text-hatofes-white font-medium mb-4">{question.question}</h3>

      {question.imageUrl && (
        <img src={question.imageUrl} alt="質問画像" className="mb-4 w-full rounded-lg max-h-48 object-contain border border-hatofes-gray" />
      )}

      {/* Multiple Choice */}
      {question.type === 'multiple_choice' && question.options && (
        <div className="space-y-2">
          {question.options.map((option, i) => (
            <label
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                value === option
                  ? 'bg-hatofes-accent-yellow/20 border border-hatofes-accent-yellow'
                  : 'bg-hatofes-dark hover:bg-hatofes-gray/20'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                value === option
                  ? 'border-hatofes-accent-yellow'
                  : 'border-hatofes-gray'
              }`}>
                {value === option && (
                  <div className="w-2 h-2 rounded-full bg-hatofes-accent-yellow" />
                )}
              </div>
              <span className="text-hatofes-white text-sm">{option}</span>
            </label>
          ))}
        </div>
      )}

      {/* Text Input */}
      {question.type === 'text' && (
        <textarea
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="回答を入力してください"
          rows={4}
          className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-3 text-hatofes-white placeholder-hatofes-gray resize-none focus:outline-none focus:border-hatofes-accent-yellow"
        />
      )}

      {/* Rating */}
      {question.type === 'rating' && (
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              className={`w-12 h-12 rounded-lg font-bold text-lg transition-colors ${
                value === rating
                  ? 'bg-hatofes-accent-yellow text-hatofes-dark'
                  : 'bg-hatofes-dark text-hatofes-white hover:bg-hatofes-gray/30'
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
