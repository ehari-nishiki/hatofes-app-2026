import { useState, useEffect } from 'react'
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { wordListA, wordListB, wordListC } from '@/mocks/wordLists'
import {
  PageBackLink,
  PageHero,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

const MAX_USERNAME_CHANGES = 3
const functions = getFunctions(app)
const changeUsernameFn = httpsCallable<
  { word1: string; word2: string; word3: string },
  { success: boolean; message: string; remainingChanges: number }
>(functions, 'changeUsername')

type RenameStep = 'idle' | 'word1' | 'word2' | 'word3' | 'confirm' | 'submitting'

export default function SettingsPage() {
  const { currentUser, userData, refreshUserData } = useAuth()

  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [renameStep, setRenameStep] = useState<RenameStep>('idle')
  const [selectedWord1, setSelectedWord1] = useState('')
  const [selectedWord2, setSelectedWord2] = useState('')
  const [selectedWord3, setSelectedWord3] = useState('')

  useEffect(() => {
    if (!userData) return
    setNotificationsEnabled(userData.notificationsEnabled ?? true)
  }, [userData])

  useEffect(() => {
    if (renameStep === 'idle') return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && renameStep !== 'submitting') handleCancelRename()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [renameStep])

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
      setRenameStep('confirm')
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
      <div className="flex min-h-screen items-center justify-center bg-[#11161a]">
        <Spinner size="lg" />
      </div>
    )
  }

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

    if (renameStep === 'confirm' || renameStep === 'submitting') {
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && renameStep !== 'submitting') handleCancelRename() }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-[1.4rem] border border-white/8 bg-[#161d22] p-6 text-center text-white shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
            <p className="text-sm text-white/52">新しいユーザーネーム</p>
            <p className="mt-2 text-2xl font-display font-black text-white">{previewUsername}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-white/56">
              <span className="rounded-full bg-black/20 px-2.5 py-1">{selectedWord1}</span>
              <span className="rounded-full bg-black/20 px-2.5 py-1">{selectedWord2}</span>
              <span className="rounded-full bg-black/20 px-2.5 py-1">{selectedWord3}</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                onClick={handleCancelRename}
                disabled={renameStep === 'submitting'}
                className="rounded-[0.95rem] bg-white/[0.06] px-4 py-3 text-sm font-medium text-white/78 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmRename}
                disabled={renameStep === 'submitting'}
                className="rounded-[0.95rem] bg-[linear-gradient(135deg,#FFC300,#FF7A18)] px-4 py-3 text-sm font-semibold text-[#11161a] disabled:opacity-50"
              >
                {renameStep === 'submitting' ? <Spinner size="sm" className="mx-auto" /> : 'この名前にする'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) handleCancelRename() }}
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-2xl rounded-[1.4rem] border border-white/8 bg-[#161d22] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
          <div className="mb-5 flex justify-center gap-2">
            {(['word1', 'word2', 'word3'] as const).map((step) => {
              const steps = ['word1', 'word2', 'word3']
              const isFilled = steps.indexOf(step) <= steps.indexOf(renameStep)
              return (
                <div
                  key={step}
                  className={`h-2 w-10 rounded-full ${isFilled ? 'bg-[linear-gradient(135deg,#FFC300,#FF7A18)]' : 'bg-white/10'}`}
                />
              )
            })}
          </div>

          <h2 className="text-center text-lg font-semibold">{title}</h2>
          <div className="mt-3 flex min-h-6 flex-wrap justify-center gap-2">
            {selectedWord1 ? <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs">{selectedWord1}</span> : null}
            {selectedWord2 ? <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs">{selectedWord2}</span> : null}
          </div>

          <div className="mt-5 max-h-[45vh] overflow-y-auto">
            <div className="flex flex-wrap justify-center gap-2">
              {words.map((word) => (
                <button
                  key={word}
                  onClick={() => onSelect(word)}
                  className="rounded-full bg-black/20 px-4 py-2 text-sm font-medium text-white/82 transition-colors hover:bg-white/[0.08]"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleCancelRename} className="mt-5 w-full rounded-[0.95rem] bg-white/[0.06] px-4 py-3 text-sm font-medium text-white/78">
            キャンセル
          </button>
        </div>
      </div>
    )
  }

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class} showThemeToggle>
      {renderWordModal()}

      <PageHero
        eyebrow="Settings"
        title="アプリ設定"
        description="通知、ユーザーネーム変更、運営へのフィードバックをここで管理します。"
        aside={<PageBackLink to="/profile" label="プロフィールに戻る" />}
      />

      {message ? (
        <div className={`mb-4 rounded-[1rem] px-4 py-3 text-sm ${message.type === 'success' ? 'bg-emerald-500/14 text-emerald-300' : 'bg-red-500/14 text-red-300'}`}>
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <PageSection>
          <PageSectionTitle eyebrow="Notifications" title="通知設定" />
          <div className="flex items-center justify-between gap-4 rounded-[1rem] bg-black/18 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-white">通知を受け取る</p>
              <p className="mt-1 text-xs text-white/46">重要なお知らせや更新情報を受信します。</p>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`relative h-7 w-14 rounded-full transition-colors ${notificationsEnabled ? 'bg-[linear-gradient(135deg,#FFC300,#FF7A18)]' : 'bg-white/12'}`}
            >
              <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${notificationsEnabled ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
          </div>
        </PageSection>

        <PageSection>
          <PageSectionTitle eyebrow="Name" title="表示名変更" />
          <div className="rounded-[1rem] bg-black/18 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-bold text-white">{userData.username}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${remainingChanges > 0 ? 'bg-white/[0.08] text-white/72' : 'bg-red-500/16 text-red-300'}`}>
                残り {remainingChanges} 回
              </span>
            </div>
            <p className="mt-3 text-sm text-white/52">「食材 + 食材 + 料理」の組み合わせで改名できます。</p>
            {remainingChanges > 0 ? (
              <button
                onClick={() => setRenameStep('word1')}
                className="mt-4 rounded-[0.95rem] bg-[linear-gradient(135deg,#FFC300,#FF7A18)] px-4 py-3 text-sm font-semibold text-[#11161a]"
              >
                表示名を変更する
              </button>
            ) : (
              <p className="mt-4 text-sm text-red-300">変更可能な回数が残っていません。</p>
            )}
          </div>
        </PageSection>
      </div>

      <PageSection className="mt-4">
        <PageSectionTitle eyebrow="Feedback" title="運営への要望" />
        <textarea
          value={feedbackMessage}
          onChange={e => setFeedbackMessage(e.target.value)}
          placeholder="要望や気づいた点を書いてください"
          disabled={feedbackSubmitting}
          rows={5}
          className="w-full resize-none rounded-[1rem] bg-black/20 px-4 py-3 text-white placeholder:text-white/28 focus:outline-none"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSubmitFeedback}
            disabled={!feedbackMessage.trim() || feedbackSubmitting}
            className="rounded-[0.95rem] bg-[linear-gradient(135deg,#FFC300,#FF7A18)] px-5 py-3 text-sm font-semibold text-[#11161a] disabled:opacity-50"
          >
            {feedbackSubmitting ? <Spinner size="sm" className="mx-auto" /> : '送信'}
          </button>
        </div>
      </PageSection>
    </UserPageShell>
  )
}
