import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Spinner } from '@/components/ui/Spinner'
import { wordListA, wordListB, wordListC } from '@/mocks/wordLists'

const MAX_USERNAME_CHANGES = 3;
const functions = getFunctions(app);
const changeUsernameFn = httpsCallable<
  { word1: string; word2: string; word3: string },
  { success: boolean; message: string; remainingChanges: number }
>(functions, 'changeUsername');

type RenameStep = 'idle' | 'word1' | 'word2' | 'word3' | 'confirm' | 'submitting'

export default function SettingsPage() {
  const { currentUser, userData, refreshUserData } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  // Rename flow state
  const [renameStep, setRenameStep] = useState<RenameStep>('idle')
  const [selectedWord1, setSelectedWord1] = useState('')
  const [selectedWord2, setSelectedWord2] = useState('')
  const [selectedWord3, setSelectedWord3] = useState('')

  useEffect(() => {
    if (!userData) return
    setNotificationsEnabled(userData.notificationsEnabled ?? true)
  }, [userData])

  const usernameChangeCount = userData?.usernameChangeCount ?? 0
  const remainingChanges = MAX_USERNAME_CHANGES - usernameChangeCount
  const previewUsername = `${selectedWord1}${selectedWord2}${selectedWord3}`

  const handleToggleNotifications = async () => {
    if (!currentUser) return
    const newVal = !notificationsEnabled
    setNotificationsEnabled(newVal)
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { notificationsEnabled: newVal })
    } catch (error) {
      console.error('Error updating notifications setting:', error)
      setNotificationsEnabled(!newVal)
    }
  }

  const handleConfirmRename = async () => {
    if (!currentUser) return
    setRenameStep('submitting')
    setMessage(null)
    try {
      const result = await changeUsernameFn({ word1: selectedWord1, word2: selectedWord2, word3: selectedWord3 })
      if (result.data.success) {
        setMessage({ type: 'success', text: result.data.message })
        setRenameStep('idle')
        setSelectedWord1('')
        setSelectedWord2('')
        setSelectedWord3('')
        refreshUserData?.()
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'ユーザーネーム変更に失敗しました'
      setMessage({ type: 'error', text: msg })
      setRenameStep('confirm') // go back to confirm so they can retry or cancel
    }
  }

  const handleCancelRename = () => {
    setRenameStep('idle')
    setSelectedWord1('')
    setSelectedWord2('')
    setSelectedWord3('')
  }

  const handleSubmitFeedback = async () => {
    if (!currentUser || !userData || !feedbackMessage.trim() || feedbackSubmitting) return
    setFeedbackSubmitting(true)
    setMessage(null)
    try {
      await addDoc(collection(db, 'feedbacks'), {
        userId: currentUser.uid,
        username: userData.username,
        message: feedbackMessage.trim(),
        createdAt: new Date(),
      })
      setMessage({ type: 'success', text: 'フィードバックを送信しました' })
      setFeedbackMessage('')
    } catch (error) {
      console.error('Error submitting feedback:', error)
      setMessage({ type: 'error', text: 'フィードバック送信に失敗しました' })
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  if (!userData) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // ─── Word selection modal overlay ───
  const renderWordModal = () => {
    let title = ''
    let words: string[] = []
    let onSelect: (w: string) => void = () => {}

    if (renameStep === 'word1') {
      title = '食材を1つ選んで'
      words = wordListA
      onSelect = (w) => { setSelectedWord1(w); setRenameStep('word2') }
    } else if (renameStep === 'word2') {
      title = 'もう1つ食材を選んで'
      words = wordListB
      onSelect = (w) => { setSelectedWord2(w); setRenameStep('word3') }
    } else if (renameStep === 'word3') {
      title = '料理を1つ選んで'
      words = wordListC
      onSelect = (w) => { setSelectedWord3(w); setRenameStep('confirm') }
    }

    if (renameStep === 'idle') return null

    // Confirm screen
    if (renameStep === 'confirm' || renameStep === 'submitting') {
      return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-hatofes-dark rounded-2xl p-6 w-full max-w-sm border border-hatofes-gray text-center">
            <p className="text-hatofes-gray text-sm mb-2">新しいユーザーネーム</p>
            <p className="text-2xl font-bold text-gradient mb-6">{previewUsername}</p>
            <div className="flex gap-2 text-xs text-hatofes-gray justify-center mb-6">
              <span className="bg-hatofes-bg px-2 py-1 rounded">{selectedWord1}</span>
              <span>＋</span>
              <span className="bg-hatofes-bg px-2 py-1 rounded">{selectedWord2}</span>
              <span>＋</span>
              <span className="bg-hatofes-bg px-2 py-1 rounded">{selectedWord3}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancelRename}
                disabled={renameStep === 'submitting'}
                className="btn-sub flex-1 py-2 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmRename}
                disabled={renameStep === 'submitting'}
                className="btn-main flex-1 py-2 disabled:opacity-50"
              >
                {renameStep === 'submitting' ? <Spinner size="sm" className="mx-auto" /> : 'この名前にする'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Word selection screen
    return (
      <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4">
        <div className="bg-hatofes-dark rounded-2xl p-6 w-full max-w-md border border-hatofes-gray">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-4">
            {(['word1', 'word2', 'word3'] as const).map((step) => {
              const steps = ['word1', 'word2', 'word3']
              const isFilled = steps.indexOf(step) <= steps.indexOf(renameStep)
              return (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-colors ${isFilled ? 'bg-hatofes-accent-yellow' : 'bg-hatofes-gray'}`}
                />
              )
            })}
          </div>

          <h2 className="text-lg font-bold text-hatofes-white text-center mb-1">{title}</h2>

          {/* Show already-selected words */}
          <div className="flex justify-center gap-1 mb-4 h-6">
            {selectedWord1 && <span className="text-xs bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow px-2 py-0.5 rounded">{selectedWord1}</span>}
            {selectedWord2 && <span className="text-xs bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow px-2 py-0.5 rounded">{selectedWord2}</span>}
          </div>

          <div className="max-h-[45vh] overflow-y-auto px-1">
            <div className="flex flex-wrap justify-center gap-2">
              {words.map((word, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelect(word)}
                  className="bg-hatofes-bg text-hatofes-white px-4 py-2 rounded-full text-sm font-medium border border-hatofes-gray hover:border-hatofes-accent-yellow hover:bg-hatofes-gray-lighter transition-all active:scale-95"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleCancelRename} className="btn-sub w-full py-2 mt-4 text-sm">
            キャンセル
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen theme-bg pb-8">
      {/* Word selection / confirm modal */}
      {renderWordModal()}

      <AppHeader
        username={userData.username}
        grade={userData.grade}
        classNumber={userData.class}
      />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Toast message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Section 1: 通知設定 */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">通知設定</h2>
          <div className="flex items-center justify-between">
            <span className="text-hatofes-white">通知を受け取る</span>
            <button
              onClick={handleToggleNotifications}
              className={`relative w-12 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-hatofes-accent-yellow' : 'bg-hatofes-gray'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </section>

        {/* Section 2: 表示設定 */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">表示設定</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
              <span className="text-hatofes-white">
                {theme === 'dark' ? 'ダークモード' : 'ライトモード'}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors ${theme === 'light' ? 'bg-hatofes-accent-yellow' : 'bg-hatofes-gray'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${theme === 'light' ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </section>

        {/* Section 3: 表示名変更 */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-2">表示名変更</h2>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-hatofes-white font-bold text-lg">{userData.username}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${remainingChanges > 0 ? 'bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow' : 'bg-red-500/20 text-red-400'}`}>
              残り{remainingChanges}回
            </span>
          </div>
          <p className="text-xs text-hatofes-gray mb-3">登録時と同じ「食材＋食材＋料理」の組み合わせで改名できます</p>
          {remainingChanges > 0 ? (
            <button
              onClick={() => setRenameStep('word1')}
              className="btn-main w-full py-2"
            >
              表示名を変更する
            </button>
          ) : (
            <p className="text-xs text-red-400">変更可能な回数が残っていません</p>
          )}
        </section>

        {/* Section 4: 運営への要望 */}
        <section className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">運営への要望</h2>
          <textarea
            value={feedbackMessage}
            onChange={e => setFeedbackMessage(e.target.value)}
            placeholder="要望やご意見をお聞かせください"
            disabled={feedbackSubmitting}
            rows={4}
            className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white placeholder-hatofes-gray disabled:opacity-50 resize-none focus:outline-none focus:border-hatofes-accent-yellow transition-colors"
          />
          <button
            onClick={handleSubmitFeedback}
            disabled={!feedbackMessage.trim() || feedbackSubmitting}
            className="btn-main w-full py-2 mt-3 disabled:opacity-50"
          >
            {feedbackSubmitting ? <Spinner size="sm" className="mx-auto" /> : '送信'}
          </button>
        </section>

        {/* Back Button */}
        <Link to="/profile" className="block">
          <div className="btn-sub w-full py-3 text-center">
            プロフィールに戻る
          </div>
        </Link>
      </main>
    </div>
  )
}
