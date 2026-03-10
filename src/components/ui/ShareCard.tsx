import { useRef, useCallback } from 'react'

interface ShareCardProps {
  title: string
  subtitle?: string
  value: string
  valueLabel?: string
  accentColor?: string
}

export function ShareCard({ title, subtitle, value, valueLabel = 'pt', accentColor = '#FFC300' }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generateImage = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = 600
    const h = 315
    canvas.width = w
    canvas.height = h

    // Background
    const gradient = ctx.createLinearGradient(0, 0, w, h)
    gradient.addColorStop(0, '#1a1a1a')
    gradient.addColorStop(1, '#2a2a2a')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    // Accent bar
    const accentGradient = ctx.createLinearGradient(0, 0, w, 0)
    accentGradient.addColorStop(0, accentColor)
    accentGradient.addColorStop(1, '#FF4E00')
    ctx.fillStyle = accentGradient
    ctx.fillRect(0, 0, w, 4)

    // Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(title, w / 2, 80)

    // Subtitle
    if (subtitle) {
      ctx.fillStyle = '#a0a0a0'
      ctx.font = '16px sans-serif'
      ctx.fillText(subtitle, w / 2, 110)
    }

    // Value
    ctx.fillStyle = accentColor
    ctx.font = 'bold 72px sans-serif'
    ctx.fillText(`${value}${valueLabel}`, w / 2, 200)

    // Branding
    ctx.fillStyle = '#666666'
    ctx.font = '14px sans-serif'
    ctx.fillText('Hato Fes App.', w / 2, 280)

    // Download or share
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return

        if (navigator.share && navigator.canShare) {
          const file = new File([blob], 'hatofes-share.png', { type: 'image/png' })
          const shareData = { files: [file], title: 'Hato Fes App' }
          if (navigator.canShare(shareData)) {
            await navigator.share(shareData)
            return
          }
        }

        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'hatofes-share.png'
        a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (error) {
      console.error('Share failed:', error)
    }
  }, [title, subtitle, value, valueLabel, accentColor])

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={generateImage}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-full bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        シェア
      </button>
    </>
  )
}
