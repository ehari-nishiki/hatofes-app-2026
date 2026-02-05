import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRegistration } from '@/hooks/useRegistration'
import { useAuth } from '@/contexts/AuthContext'
import ProgressBar from '@/components/ui/ProgressBar'
import { wordListA, wordListB, wordListC } from '@/mocks/wordLists'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { currentUser, userData, loading: authLoading, userDataChecked } = useAuth()
  const {
    state,
    prevStep,
    goToStep,
    setGrade,
    setClass,
    setStudentNumber,
    setWord1,
    setWord2,
    setWord3,
    submitRegistration,
    getProgress,
  } = useRegistration()

  // 登録処理が実行中かどうかを追跡
  const isSubmittingRef = useRef(false)

  // ログインしていなければ /auth/google にリダイレクト
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate('/auth/google')
    }
  }, [authLoading, currentUser, navigate])

  // 既に登録済みの場合は /home へ
  useEffect(() => {
    if (userDataChecked && userData) {
      navigate('/home')
    }
  }, [userDataChecked, userData, navigate])

  // loading ステップに入ったら登録処理を実行（一度だけ）
  useEffect(() => {
    if (state.step === 'loading' && !isSubmittingRef.current) {
      isSubmittingRef.current = true
      submitRegistration().finally(() => {
        isSubmittingRef.current = false
      })
    }
  }, [state.step, submitRegistration])

  // 認証中は何も表示しない
  if (authLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <div className="text-hatofes-white">読み込み中...</div>
      </div>
    )
  }

  const progress = getProgress()
  const showProgress = !['initial', 'google-auth'].includes(state.step)

  return (
    <div className="min-h-screen bg-hatofes-bg flex flex-col">
      {/* Progress Bar */}
      {showProgress && (
        <div className="px-4 pt-4">
          <ProgressBar progress={progress} />
        </div>
      )}

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {state.step === 'google-auth' && (
          <GoogleAuthStep
            onAuth={() => goToStep('grade')}
            onBack={() => navigate('/login')}
          />
        )}

        {state.step === 'grade' && (
          <GradeStep onSelect={setGrade} />
        )}

        {state.step === 'class' && (
          <ClassStep onSelect={setClass} onBack={prevStep} />
        )}

        {state.step === 'student-number' && (
          <StudentNumberStep onSelect={setStudentNumber} onBack={prevStep} />
        )}

        {state.step === 'word1' && (
          <WordStep
            title="1つ選ぼう。"
            words={wordListA}
            onSelect={setWord1}
            onBack={prevStep}
          />
        )}

        {state.step === 'word2' && (
          <WordStep
            title="もう1つ選ぼう。"
            words={wordListB}
            onSelect={setWord2}
            onBack={prevStep}
          />
        )}

        {state.step === 'word3' && (
          <WordStep
            title="最後に1つ選ぼう。"
            words={wordListC}
            onSelect={setWord3}
            onBack={prevStep}
          />
        )}

        {state.step === 'loading' && <LoadingStep />}

        {state.step === 'success' && (
          <SuccessStep
            username={state.data.username || ''}
            grade={state.data.grade}
            classNumber={state.data.classNumber}
            studentNumber={state.data.studentNumber}
            onStart={() => navigate('/home')}
            onEdit={() => goToStep('grade')}
          />
        )}

        {state.step === 'error' && (
          <ErrorStep
            message={state.error || '登録に失敗しました'}
            onRetry={() => goToStep('word1')}
          />
        )}
      </main>
    </div>
  )
}

// --- Step Components ---

function GoogleAuthStep({
  onAuth,
  onBack,
}: {
  onAuth: () => void
  onBack: () => void
}) {
  const handleGoogleAuth = () => {
    // TODO: Firebase Google認証
    onAuth()
  }

  return (
    <div className="w-full max-w-sm text-center space-y-8">
      {/* Logo */}
      <div className="mb-12">
        <p className="text-sm text-hatofes-white mb-2">
          第 <span className="text-gradient font-display text-2xl font-bold mx-1">70</span> 期 鳩祭実行委員会
        </p>
        <h1 className="font-display text-3xl font-bold text-gradient">
          Hato Fes App.
        </h1>
      </div>

      {/* Google Login Button */}
      <button onClick={handleGoogleAuth} className="btn-main w-full py-3 rounded-full">
        Googleでログイン
      </button>

      {/* Back Button */}
      <button onClick={onBack} className="btn-sub w-full py-3 rounded-full">
        ホームに戻る
      </button>
    </div>
  )
}

function GradeStep({ onSelect }: { onSelect: (grade: number | 'teacher') => void }) {
  const gradeStyles = {
    1: 'bg-gradient-to-br from-[#FF0000] to-[#FF7300]',
    2: 'bg-gradient-to-br from-[#2B01FF] to-[#00D5FF]',
    3: 'bg-gradient-to-br from-[#00EF44] to-[#00b05b]',
    teacher: 'bg-gradient-to-br from-[#FFC300] to-[#FF4E00]',
  }

  return (
    <div className="w-full max-w-xs text-center">
      <h2 className="text-2xl font-bold text-hatofes-white mb-8">学年は？</h2>
      <div className="grid grid-cols-2 gap-6">
        {([1, 2, 3] as const).map(grade => (
          <button
            key={grade}
            onClick={() => onSelect(grade)}
            className={`${gradeStyles[grade]} text-hatofes-white w-24 h-24 rounded-full text-3xl font-bold shadow-lg hover:scale-105 transition-transform mx-auto`}
          >
            {grade}
          </button>
        ))}
        <button
          onClick={() => onSelect('teacher')}
          className={`${gradeStyles.teacher} text-hatofes-white w-24 h-24 rounded-full text-base font-bold shadow-lg hover:scale-105 transition-transform mx-auto`}
        >
          教員
        </button>
      </div>
    </div>
  )
}

function ClassStep({
  onSelect,
  onBack,
}: {
  onSelect: (classNumber: string) => void
  onBack: () => void
}) {
  const classes = ['1', '2', '3', '4', '5', '6', '7', 'A', 'B']

  return (
    <div className="w-full max-w-sm text-center">
      <h2 className="text-2xl font-bold text-hatofes-white mb-8">クラスは？</h2>
      <div className="grid grid-cols-3 gap-4">
        {classes.map(cls => (
          <button
            key={cls}
            onClick={() => onSelect(cls)}
            className="bg-hatofes-dark text-hatofes-white w-16 h-16 rounded-full text-xl font-bold border border-hatofes-gray hover:border-hatofes-accent-yellow hover:scale-105 transition-all mx-auto"
          >
            {cls}
          </button>
        ))}
      </div>
      <button onClick={onBack} className="btn-sub w-full py-3 rounded-full mt-8">
        戻る
      </button>
    </div>
  )
}

function StudentNumberStep({
  onSelect,
  onBack,
}: {
  onSelect: (num: number) => void
  onBack: () => void
}) {
  const numbers = Array.from({ length: 41 }, (_, i) => i + 1)

  return (
    <div className="w-full max-w-md text-center">
      <h2 className="text-2xl font-bold text-hatofes-white mb-8">名簿番号は？</h2>
      <div className="max-h-[50vh] overflow-y-auto px-2">
        <div className="grid grid-cols-7 gap-2">
          {numbers.map(num => (
            <button
              key={num}
              onClick={() => onSelect(num)}
              className="bg-hatofes-dark text-hatofes-white w-10 h-10 rounded-full text-sm font-medium border border-hatofes-gray hover:border-hatofes-accent-yellow hover:scale-105 transition-all"
            >
              {num}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onBack} className="btn-sub w-full py-3 rounded-full mt-6">
        戻る
      </button>
    </div>
  )
}

function WordStep({
  title,
  words,
  onSelect,
  onBack,
}: {
  title: string
  words: string[]
  onSelect: (word: string) => void
  onBack: () => void
}) {
  return (
    <div className="w-full max-w-md text-center">
      <h2 className="text-2xl font-bold text-hatofes-white mb-8">{title}</h2>
      <div className="max-h-[50vh] overflow-y-auto px-2">
        <div className="flex flex-wrap justify-center gap-3">
          {words.map((word, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(word)}
              className="bg-hatofes-dark text-hatofes-white px-4 py-2 rounded-full text-sm font-medium border border-hatofes-gray hover:border-hatofes-accent-yellow hover:bg-hatofes-gray-lighter transition-all"
            >
              {word}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onBack} className="btn-sub w-full py-3 rounded-full mt-6">
        戻る
      </button>
    </div>
  )
}

function LoadingStep() {
  return (
    <div className="text-center">
      <div className="mb-8">
        <div className="w-16 h-16 border-4 border-hatofes-accent-yellow border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
      <h2 className="text-2xl font-bold text-hatofes-white">調理中です...</h2>
    </div>
  )
}

function SuccessStep({
  username,
  grade,
  classNumber,
  studentNumber,
  onStart,
  onEdit,
}: {
  username: string
  grade?: number | 'teacher'
  classNumber?: string
  studentNumber?: number
  onStart: () => void
  onEdit: () => void
}) {
  const gradeText = grade === 'teacher' ? '教員' : `${grade}年`
  const classText = classNumber && classNumber !== '-' ? `${classNumber}組` : ''
  const numberText = studentNumber && studentNumber > 0 ? `${studentNumber}番` : ''

  return (
    <div className="w-full max-w-sm text-center">
      <h2 className="text-3xl font-bold text-gradient mb-8">大成功です！</h2>

      <div className="mb-8">
        <p className="text-hatofes-white mb-2">あなたのユーザーネームは</p>
        <p className="text-2xl font-bold text-gradient mb-2">{username}</p>
        <p className="text-hatofes-white">です！</p>
      </div>

      <div className="mb-8 text-hatofes-white">
        <p className="text-hatofes-gray-light">登録情報は</p>
        <p className="text-hatofes-white">{gradeText} {classText} {numberText}</p>
      </div>

      <button onClick={onStart} className="btn-main w-full py-3 rounded-full mb-4">
        はじめよう！
      </button>

      <button onClick={onEdit} className="btn-sub w-full py-3 rounded-full">
        登録情報を編集
      </button>
    </div>
  )
}

function ErrorStep({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="w-full max-w-sm text-center">
      <h2 className="text-3xl font-bold text-hatofes-accent-orange mb-8">失敗...</h2>
      <p className="text-hatofes-white mb-8">{message}</p>
      <p className="text-hatofes-white mb-8">
        別の食材を選んで<br />再登録しよう！
      </p>
      <button onClick={onRetry} className="btn-main w-full py-3 rounded-full">
        もう一度試す
      </button>
    </div>
  )
}
