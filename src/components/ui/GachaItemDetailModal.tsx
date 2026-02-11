import { useRef, useEffect } from 'react'
import { animate } from 'animejs'
import type { GachaRarity } from '@/types/firestore'

interface GachaItemDetailModalProps {
  isOpen: boolean
  onClose: () => void
  item: {
    name: string
    description?: string
    rarity: GachaRarity
    type: string
    imageUrl?: string
    pointsValue?: number | null
    ticketValue?: number | null
    pulledAt?: { seconds: number }
  }
}

const RARITY_CONFIG: Record<
  GachaRarity,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  common: {
    label: 'コモン',
    color: '#9ca3af',
    bgColor: 'rgba(156,163,175,0.1)',
    borderColor: 'rgba(156,163,175,0.3)',
  },
  uncommon: {
    label: 'アンコモン',
    color: '#4ade80',
    bgColor: 'rgba(74,222,128,0.1)',
    borderColor: 'rgba(74,222,128,0.3)',
  },
  rare: {
    label: 'レア',
    color: '#60a5fa',
    bgColor: 'rgba(96,165,250,0.1)',
    borderColor: 'rgba(96,165,250,0.3)',
  },
  epic: {
    label: 'エピック',
    color: '#c084fc',
    bgColor: 'rgba(192,132,252,0.1)',
    borderColor: 'rgba(192,132,252,0.3)',
  },
  legendary: {
    label: 'レジェンダリー',
    color: '#FFC300',
    bgColor: 'rgba(255,195,0,0.1)',
    borderColor: 'rgba(255,195,0,0.3)',
  },
}

const TYPE_LABELS: Record<string, string> = {
  badge: 'バッジ',
  coupon: 'クーポン',
  points: 'ポイント',
  ticket: 'チケット',
  custom: 'カスタム',
}

export function GachaItemDetailModal({
  isOpen,
  onClose,
  item,
}: GachaItemDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const config = RARITY_CONFIG[item.rarity]

  useEffect(() => {
    if (isOpen && cardRef.current) {
      animate(cardRef.current, {
        scale: [0.8, 1],
        opacity: [0, 1],
        duration: 300,
        ease: 'outBack',
      })
    }
  }, [isOpen])

  const handleClose = () => {
    if (cardRef.current) {
      animate(cardRef.current, {
        scale: [1, 0.8],
        opacity: [1, 0],
        duration: 200,
        ease: 'inQuad',
        onComplete: onClose,
      })
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={handleClose}
    >
      <div
        ref={cardRef}
        className="max-w-sm w-full rounded-2xl overflow-hidden opacity-0"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: `2px solid ${config.borderColor}`,
          boxShadow: `0 0 30px ${config.bgColor}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with rarity gradient */}
        <div
          className="h-2"
          style={{
            background: `linear-gradient(90deg, ${config.color}, ${config.color}88, ${config.color})`,
          }}
        />

        <div className="p-6">
          {/* Image or icon */}
          <div className="flex justify-center mb-4">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-28 h-28 rounded-xl object-cover"
                style={{ boxShadow: `0 0 20px ${config.bgColor}` }}
              />
            ) : (
              <div
                className="w-28 h-28 rounded-xl flex items-center justify-center text-5xl"
                style={{ background: config.bgColor }}
              >
                {item.type === 'points'
                  ? '💰'
                  : item.type === 'ticket'
                  ? '🎫'
                  : item.type === 'badge'
                  ? '🏅'
                  : item.type === 'coupon'
                  ? '🎟️'
                  : '🎁'}
              </div>
            )}
          </div>

          {/* Rarity badge */}
          <div className="flex justify-center mb-3">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: config.bgColor, color: config.color }}
            >
              {config.label}
            </span>
          </div>

          {/* Name */}
          <h3
            className="text-xl font-bold text-center mb-2"
            style={{ color: config.color }}
          >
            {item.name}
          </h3>

          {/* Description */}
          {item.description && (
            <p className="text-white/60 text-sm text-center mb-4">
              {item.description}
            </p>
          )}

          {/* Details */}
          <div
            className="rounded-lg p-4 space-y-2"
            style={{ background: 'rgba(0,0,0,0.3)' }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-white/50">タイプ</span>
              <span className="text-white">{TYPE_LABELS[item.type] || item.type}</span>
            </div>

            {item.type === 'points' && item.pointsValue && (
              <div className="flex justify-between text-sm">
                <span className="text-white/50">付与ポイント</span>
                <span className="text-hatofes-accent-yellow font-bold">
                  +{item.pointsValue} pt
                </span>
              </div>
            )}

            {item.type === 'ticket' && item.ticketValue && (
              <div className="flex justify-between text-sm">
                <span className="text-white/50">付与チケット</span>
                <span className="text-hatofes-accent-yellow font-bold">
                  +{item.ticketValue} 枚
                </span>
              </div>
            )}

            {item.pulledAt && (
              <div className="flex justify-between text-sm">
                <span className="text-white/50">獲得日時</span>
                <span className="text-white/80">
                  {new Date(item.pulledAt.seconds * 1000).toLocaleString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="w-full mt-4 py-3 rounded-lg font-bold text-white/80 hover:text-white transition-colors"
            style={{ background: config.bgColor }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
