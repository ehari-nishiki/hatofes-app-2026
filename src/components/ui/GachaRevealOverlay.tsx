import { useEffect, useRef, useState } from 'react'
import type { GachaRarity } from '@/types/firestore'
import { GRADIENT_STYLES } from '@/lib/animations'

interface GachaRevealOverlayProps {
  active: boolean
  rarity: GachaRarity
  itemName: string
  itemDescription?: string
  itemImageUrl?: string
  itemType: string
  pointsValue?: number | null
  ticketValue?: number | null
  onComplete: () => void
}

const RARITY_CONFIG: Record<
  GachaRarity,
  {
    label: string
    colors: string[]
    bgGradient: string
    glowColor: string
    particleCount: number
    buildupDuration: number // ローディング時間
  }
> = {
  common: {
    label: 'COMMON',
    colors: ['#9ca3af', '#d1d5db', '#f3f4f6'],
    bgGradient: 'radial-gradient(circle, rgba(156,163,175,0.3) 0%, transparent 70%)',
    glowColor: 'rgba(156,163,175,0.5)',
    particleCount: 20,
    buildupDuration: 500,
  },
  uncommon: {
    label: 'UNCOMMON',
    colors: ['#4ade80', '#86efac', '#22c55e'],
    bgGradient: 'radial-gradient(circle, rgba(74,222,128,0.3) 0%, transparent 70%)',
    glowColor: 'rgba(74,222,128,0.5)',
    particleCount: 30,
    buildupDuration: 500,
  },
  rare: {
    label: 'RARE',
    colors: ['#60a5fa', '#3b82f6', '#1d4ed8'],
    bgGradient: 'radial-gradient(circle, rgba(96,165,250,0.4) 0%, transparent 70%)',
    glowColor: 'rgba(96,165,250,0.6)',
    particleCount: 50,
    buildupDuration: 500,
  },
  epic: {
    label: 'EPIC',
    colors: ['#a855f7', '#c084fc'],
    bgGradient: 'radial-gradient(circle, rgba(192,132,252,0.5) 0%, transparent 70%)',
    glowColor: 'rgba(192,132,252,0.7)',
    particleCount: 80,
    buildupDuration: 800,
  },
  legendary: {
    label: 'LEGENDARY',
    colors: ['#FFC300', '#FF4E00'],
    bgGradient: 'radial-gradient(circle, rgba(255,195,0,0.6) 0%, rgba(255,78,0,0.3) 50%, transparent 80%)',
    glowColor: 'rgba(255,195,0,0.8)',
    particleCount: 120,
    buildupDuration: 1200,
  },
}

export function GachaRevealOverlay({
  active,
  rarity,
  itemName,
  itemDescription,
  itemImageUrl,
  itemType,
  pointsValue,
  ticketValue,
  onComplete,
}: GachaRevealOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'buildup' | 'reveal' | 'shown'>('buildup')
  const [showSkip, setShowSkip] = useState(false)

  const config = RARITY_CONFIG[rarity]

  useEffect(() => {
    if (!active) {
      setPhase('buildup')
      setShowSkip(false)
      return
    }

    const skipTimer = setTimeout(() => setShowSkip(true), 300)
    const buildupDuration = config.buildupDuration

    const revealTimer = setTimeout(() => {
      setPhase('reveal')
      setTimeout(() => {
        setPhase('shown')
        startParticles()
      }, 150)
    }, buildupDuration)

    return () => {
      clearTimeout(skipTimer)
      clearTimeout(revealTimer)
    }
  }, [active, rarity, config.buildupDuration])

  const startParticles = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      color: string
      size: number
      life: number
      maxLife: number
      rotation: number
      rotationSpeed: number
    }

    const particles: Particle[] = []
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    for (let i = 0; i < config.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / config.particleCount + Math.random() * 0.5
      const velocity = 5 + Math.random() * 10

      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 3,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        size: 5 + Math.random() * 8,
        life: 0,
        maxLife: 80 + Math.random() * 40,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      })
    }

    let animationId: number

    const animateParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.15
        p.vx *= 0.99
        p.rotation += p.rotationSpeed
        p.life++

        const alpha = Math.max(0, 1 - p.life / p.maxLife)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()

        if (p.life >= p.maxLife) {
          particles.splice(i, 1)
        }
      }

      ctx.globalAlpha = 1

      if (particles.length > 0) {
        animationId = requestAnimationFrame(animateParticles)
      }
    }

    animationId = requestAnimationFrame(animateParticles)

    return () => cancelAnimationFrame(animationId)
  }

  const handleSkip = () => {
    setPhase('shown')
    startParticles()
  }

  if (!active) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-colors duration-300 ${
        phase === 'reveal' ? 'bg-white/20' : 'bg-black/95'
      }`}
      onClick={phase === 'shown' ? onComplete : undefined}
    >
      {/* Background glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          phase === 'shown' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: config.bgGradient }}
      />

      {/* Particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Buildup indicator */}
      {phase === 'buildup' && (
        <div className="text-center animate-pulse">
          <div
            className="w-24 h-24 rounded-full border-4 mx-auto mb-4"
            style={{
              borderColor: config.colors[0],
              boxShadow: `0 0 30px ${config.glowColor}`,
              animation: rarity === 'legendary' ? 'shake 0.1s infinite' : undefined,
            }}
          >
            <div className="w-full h-full rounded-full flex items-center justify-center text-4xl">
              🎁
            </div>
          </div>
          <p className="text-white/60 text-sm">開封中...</p>
        </div>
      )}

      {/* Reveal card */}
      {phase === 'shown' && (
        <div
          className="relative max-w-sm w-full mx-4 animate-card-entrance"
          style={{ perspective: '1000px' }}
        >
          <div
            className="rounded-2xl p-6 text-center border-2"
            style={{
              background: `linear-gradient(135deg, rgba(20,20,40,0.95) 0%, rgba(30,30,60,0.95) 100%)`,
              borderColor: config.colors[0],
              boxShadow: `0 0 40px ${config.glowColor}, inset 0 0 30px ${config.glowColor}`,
            }}
          >
            {/* Rarity label with gradient text for legendary/epic */}
            <div
              className="inline-block px-4 py-1 rounded-full text-sm font-bold tracking-widest mb-4 font-display"
              style={{
                ...(rarity === 'legendary' && GRADIENT_STYLES.gold as React.CSSProperties),
                ...(rarity === 'epic' && GRADIENT_STYLES.purple as React.CSSProperties),
                ...(rarity !== 'legendary' && rarity !== 'epic' && {
                  background: `linear-gradient(90deg, ${config.colors.join(', ')})`,
                  color: rarity === 'common' ? '#000' : '#fff',
                }),
              }}
            >
              {config.label}
            </div>

            {/* Item image or icon */}
            <div className="mb-4">
              {itemImageUrl ? (
                <img
                  src={itemImageUrl}
                  alt={itemName}
                  className="w-32 h-32 mx-auto rounded-lg object-cover"
                  style={{ boxShadow: `0 0 20px ${config.glowColor}` }}
                />
              ) : (
                <div
                  className="w-32 h-32 mx-auto rounded-lg flex items-center justify-center text-6xl"
                  style={{
                    background: `linear-gradient(135deg, ${config.colors[0]}20, ${config.colors[1] || config.colors[0]}20)`,
                    boxShadow: `0 0 20px ${config.glowColor}`,
                  }}
                >
                  {itemType === 'points' ? '💰' : itemType === 'ticket' ? '🎫' : itemType === 'badge' ? '🏅' : itemType === 'coupon' ? '🎟️' : '🎁'}
                </div>
              )}
            </div>

            {/* Item name */}
            <h2 className="text-2xl font-bold mb-2" style={{ color: config.colors[0] }}>
              {itemName}
            </h2>

            {/* Description */}
            {itemDescription && (
              <p className="text-white/70 text-sm mb-4">{itemDescription}</p>
            )}

            {/* Value - DINフォント＋グラデーション */}
            {itemType === 'points' && pointsValue && (
              <div
                className="inline-block px-4 py-2 rounded-lg text-xl font-bold font-display"
                style={{ background: `${config.colors[0]}30` }}
              >
                <span style={GRADIENT_STYLES.gold as React.CSSProperties}>
                  +{pointsValue}
                </span>
                <span className="text-white/60 text-base ml-1">pt</span>
              </div>
            )}
            {itemType === 'ticket' && ticketValue && (
              <div
                className="inline-block px-4 py-2 rounded-lg text-xl font-bold font-display"
                style={{ background: `${config.colors[0]}30` }}
              >
                <span style={GRADIENT_STYLES.gold as React.CSSProperties}>
                  +{ticketValue}
                </span>
                <span className="text-white/60 text-base ml-1">🎫</span>
              </div>
            )}

            <p className="text-white/30 text-xs mt-6">TAP TO CONTINUE</p>
          </div>
        </div>
      )}

      {/* Skip button */}
      {showSkip && phase !== 'shown' && (
        <button
          onClick={handleSkip}
          className="absolute bottom-8 right-8 text-white/50 text-sm hover:text-white/80 transition-colors"
        >
          スキップ →
        </button>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes card-entrance {
          0% {
            opacity: 0;
            transform: scale(0) rotateY(90deg);
          }
          60% {
            transform: scale(1.1) rotateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotateY(0);
          }
        }
        .animate-card-entrance {
          animation: card-entrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  )
}
