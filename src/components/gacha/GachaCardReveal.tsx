import { useState, useEffect, useRef } from 'react'
import type { GachaRarity } from '@/types/firestore'
import { GRADIENT_STYLES } from '@/lib/animations'

interface CardData {
  id: string
  name: string
  description: string
  rarity: GachaRarity
  type: string
  pointsValue: number | null
  ticketValue: number | null
  imageUrl?: string
}

interface GachaCardRevealProps {
  active: boolean
  cards: CardData[]
  onComplete: () => void
}

const RARITY_CONFIG: Record<GachaRarity, {
  label: string
  colors: string[]
  bgGradient: string
  glowColor: string
}> = {
  common: {
    label: 'コモン',
    colors: ['#9ca3af', '#d1d5db', '#f3f4f6'],
    bgGradient: 'linear-gradient(135deg, #4a4a4a 0%, #2a2a2a 100%)',
    glowColor: 'rgba(156,163,175,0.5)',
  },
  uncommon: {
    label: 'アンコモン',
    colors: ['#4ade80', '#86efac', '#22c55e'],
    bgGradient: 'linear-gradient(135deg, #1a4a2a 0%, #0a2a1a 100%)',
    glowColor: 'rgba(74,222,128,0.5)',
  },
  rare: {
    label: 'レア',
    colors: ['#60a5fa', '#3b82f6', '#1d4ed8'],
    bgGradient: 'linear-gradient(135deg, #1a3a5a 0%, #0a1a3a 100%)',
    glowColor: 'rgba(96,165,250,0.6)',
  },
  epic: {
    label: 'エピック',
    colors: ['#a855f7', '#c084fc'],
    bgGradient: 'linear-gradient(135deg, #3a1a5a 0%, #1a0a3a 100%)',
    glowColor: 'rgba(192,132,252,0.7)',
  },
  legendary: {
    label: 'レジェンダリー',
    colors: ['#FFC300', '#FF4E00'],
    bgGradient: 'linear-gradient(135deg, #5a3a0a 0%, #3a1a00 100%)',
    glowColor: 'rgba(255,195,0,0.8)',
  },
}

function CardDetailView({ card, index, total, onNext }: {
  card: CardData
  index: number
  total: number
  onNext: () => void
}) {
  const config = RARITY_CONFIG[card.rarity]
  const slideDirection = index % 2 === 0 ? 'left' : 'right'

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/90"
      onClick={onNext}
    >
      {/* Progress indicator */}
      <div className="absolute top-8 left-0 right-0 flex justify-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i < index ? 'bg-white/30' : i === index ? 'bg-white' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      <div
        className={`relative max-w-xs w-full mx-4 ${slideDirection === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right'}`}
        style={{ perspective: '1000px' }}
      >
        <div
          className="rounded-2xl p-5 text-center border-2 backdrop-blur-xl"
          style={{
            background: `linear-gradient(135deg, rgba(20,20,40,0.95) 0%, rgba(30,30,60,0.95) 100%)`,
            borderColor: config.colors[0],
            boxShadow: `0 0 40px ${config.glowColor}, inset 0 0 20px ${config.glowColor}`,
          }}
        >
          {/* Rarity label */}
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-widest mb-3 font-display"
            style={{
              ...(card.rarity === 'legendary' && GRADIENT_STYLES.gold as React.CSSProperties),
              ...(card.rarity === 'epic' && GRADIENT_STYLES.purple as React.CSSProperties),
              ...(card.rarity !== 'legendary' && card.rarity !== 'epic' && {
                background: `linear-gradient(90deg, ${config.colors.join(', ')})`,
                color: card.rarity === 'common' ? '#000' : '#fff',
              }),
            }}
          >
            {config.label}
          </div>

          {/* Item image or icon */}
          <div className="mb-3">
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.name}
                className="w-20 h-20 mx-auto rounded-lg object-cover"
                style={{ boxShadow: `0 0 15px ${config.glowColor}` }}
              />
            ) : (
              <div
                className="w-20 h-20 mx-auto rounded-lg flex items-center justify-center text-4xl"
                style={{
                  background: `linear-gradient(135deg, ${config.colors[0]}20, ${config.colors[1] || config.colors[0]}20)`,
                  boxShadow: `0 0 15px ${config.glowColor}`,
                }}
              >
                {card.type === 'points' ? '💰' : card.type === 'ticket' ? '🎫' : card.type === 'badge' ? '🏅' : '🎁'}
              </div>
            )}
          </div>

          {/* Item name */}
          <h2 className="text-lg font-bold mb-1" style={{ color: config.colors[0] }}>
            {card.name}
          </h2>

          {/* Description */}
          {card.description && (
            <p className="text-white/60 text-xs mb-3">{card.description}</p>
          )}

          {/* Value */}
          {card.type === 'points' && card.pointsValue && (
            <div
              className="inline-block px-3 py-1.5 rounded-lg text-base font-bold font-display"
              style={{ background: `${config.colors[0]}30` }}
            >
              <span style={GRADIENT_STYLES.gold as React.CSSProperties}>
                +{card.pointsValue}
              </span>
              <span className="text-white/60 text-sm ml-1">pt</span>
            </div>
          )}
          {card.type === 'ticket' && card.ticketValue && (
            <div
              className="inline-block px-3 py-1.5 rounded-lg text-base font-bold font-display"
              style={{ background: `${config.colors[0]}30` }}
            >
              <span style={GRADIENT_STYLES.gold as React.CSSProperties}>
                +{card.ticketValue}
              </span>
              <span className="text-white/60 text-sm ml-1">🎫</span>
            </div>
          )}

          <p className="text-white/30 text-xs mt-4 font-din tracking-wider">
            {index < total - 1 ? 'TAP TO NEXT' : 'TAP TO FINISH'}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-left {
          0% { opacity: 0; transform: translateX(-80px) scale(0.9); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slide-in-right {
          0% { opacity: 0; transform: translateX(80px) scale(0.9); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  )
}

export function GachaCardReveal({ active, cards, onComplete }: GachaCardRevealProps) {
  const [phase, setPhase] = useState<'smoke' | 'ready' | 'revealing'>('smoke')
  const [currentIndex, setCurrentIndex] = useState(0)
  const smokeCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) {
      setPhase('smoke')
      setCurrentIndex(0)
      return
    }

    // Start smoke animation
    const canvas = smokeCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    interface Smoke {
      x: number
      y: number
      size: number
      alpha: number
      vx: number
      vy: number
    }

    const smokeParticles: Smoke[] = []
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    // Create initial smoke burst
    for (let i = 0; i < 40; i++) {
      smokeParticles.push({
        x: centerX + (Math.random() - 0.5) * 80,
        y: centerY + (Math.random() - 0.5) * 80,
        size: 40 + Math.random() * 80,
        alpha: 0.5 + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3 - 1,
      })
    }

    let animationId: number
    let frame = 0

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++

      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i]
        p.x += p.vx
        p.y += p.vy
        p.alpha -= 0.008
        p.size += 0.5

        if (p.alpha <= 0) {
          smokeParticles.splice(i, 1)
          continue
        }

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
        gradient.addColorStop(0, `rgba(255, 195, 0, ${p.alpha * 0.25})`)
        gradient.addColorStop(0.5, `rgba(255, 140, 0, ${p.alpha * 0.1})`)
        gradient.addColorStop(1, 'transparent')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      if (frame > 25) {
        setPhase('ready')
      }

      if (smokeParticles.length > 0) {
        animationId = requestAnimationFrame(animate)
      }
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [active])

  const handleReveal = () => {
    setPhase('revealing')
  }

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      onComplete()
    }
  }

  const handleSkipAll = () => {
    onComplete()
  }

  if (!active) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center">
      {/* Smoke canvas */}
      <canvas ref={smokeCanvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Ready state - show cards and reveal button */}
      {phase === 'ready' && (
        <div className="relative z-10 flex flex-col items-center px-4">
          {/* Cards grid - arranged side by side */}
          <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-xs">
            {cards.map((card, i) => {
              const config = RARITY_CONFIG[card.rarity]
              return (
                <div
                  key={i}
                  className="card-float"
                  style={{
                    animationDelay: `${i * 0.15}s`,
                  }}
                >
                  <div
                    className="w-12 h-16 rounded-lg shadow-lg flex items-center justify-center"
                    style={{
                      background: config.bgGradient,
                      border: `2px solid ${config.colors[0]}`,
                      boxShadow: `0 0 10px ${config.glowColor}`,
                    }}
                  >
                    <span className="text-lg opacity-60">🎴</span>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-white/70 text-sm mb-4">
            {cards.length}枚のカードを獲得しました
          </p>

          {/* Reveal button */}
          <button
            onClick={handleReveal}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange text-black font-bold text-lg hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-hatofes-accent-yellow/30"
          >
            🎴 めくる
          </button>

          <button
            onClick={handleSkipAll}
            className="mt-4 px-5 py-2 text-white/40 hover:text-white/70 text-sm font-din tracking-wider transition-colors"
          >
            Skip All
          </button>
        </div>
      )}

      {/* Smoke phase - just show loading */}
      {phase === 'smoke' && (
        <div className="relative z-10 text-center">
          <p className="text-white/60 animate-pulse">カードが現れています...</p>
        </div>
      )}

      {/* Revealing phase - show cards one by one */}
      {phase === 'revealing' && (
        <CardDetailView
          card={cards[currentIndex]}
          index={currentIndex}
          total={cards.length}
          onNext={handleNext}
        />
      )}

      <style>{`
        @keyframes card-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .card-float {
          animation: card-float 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
