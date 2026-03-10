import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // Focus trap & escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    confirmBtnRef.current?.focus()

    // Prevent body scroll
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, loading, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <div
        ref={dialogRef}
        className="bg-hatofes-bg rounded-2xl p-6 max-w-sm w-full border border-hatofes-gray"
      >
        <h2 id="confirm-title" className="text-lg font-bold text-hatofes-white mb-2">
          {title}
        </h2>
        <p id="confirm-message" className="text-sm text-hatofes-gray-light mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg border border-hatofes-gray text-hatofes-white hover:bg-hatofes-dark transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'btn-main'
            }`}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                処理中...
              </span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
