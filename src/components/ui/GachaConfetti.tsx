import { useRef, useEffect } from 'react'
import type { GachaRarity } from '@/types/firestore'
import { CONFETTI_COLORS } from '@/lib/animations'

const PALETTES: Record<GachaRarity, string[]> = {
  common:     ['#9ca3af', '#d1d5db', '#f3f4f6'],
  uncommon:   CONFETTI_COLORS.green,
  rare:       CONFETTI_COLORS.blue,
  epic:       [...CONFETTI_COLORS.purple, '#FFC300'],
  legendary:  [...CONFETTI_COLORS.gold, '#ffffff'],
}

const SPAWN_PER_FRAME: Record<GachaRarity, number> = {
  common: 2, uncommon: 3, rare: 4, epic: 6, legendary: 8,
}

const SPAWN_MS: Record<GachaRarity, number> = {
  common: 1000, uncommon: 1200, rare: 1500, epic: 2000, legendary: 2500,
}

const PARTICLE_LIFE = 1600

class ConfettiParticle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  life: number
  spin: number
  spinSpeed: number
  size: number

  constructor(x: number, y: number, vx: number, vy: number, color: string) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.color = color
    this.life = 0
    this.spin = Math.random() * Math.PI * 2
    this.spinSpeed = 2 + Math.random() * 4
    this.size = 7 + Math.random() * 5
  }

  update() {
    this.spin += this.spinSpeed * 0.025
    this.vx *= 0.995
    this.vy = this.vy * 0.999 + 0.07
    this.x += this.vx + Math.sin(this.life * 0.06) * 0.4
    this.y += this.vy
    this.life++
  }

  draw(ctx: CanvasRenderingContext2D) {
    let alpha = 1
    if (this.life > PARTICLE_LIFE - 400) {
      alpha = (PARTICLE_LIFE - this.life) / 400
    }

    const w = this.size
    const h = Math.cos(this.spin) * this.size * 0.85

    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.moveTo(this.x, this.y)
    ctx.lineTo(this.x + w * 0.4, this.y + h)
    ctx.lineTo(this.x + w + w * 0.4, this.y + h)
    ctx.lineTo(this.x + w, this.y)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

interface GachaConfettiProps {
  active: boolean
  rarity: GachaRarity
}

export function GachaConfetti({ active, rarity }: GachaConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return

    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const canvas: HTMLCanvasElement = canvasEl

    const setSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    setSize()
    window.addEventListener('resize', setSize)

    const ctx = canvas.getContext('2d')!
    ctx.globalCompositeOperation = 'source-over'

    let particles: ConfettiParticle[] = []
    const startTime = performance.now()
    let frame = 0
    let animId: number
    let running = true

    const palette = PALETTES[rarity]
    const perFrame = SPAWN_PER_FRAME[rarity]
    const spawnDuration = SPAWN_MS[rarity]

    function loop() {
      if (!running) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++

      const elapsed = performance.now() - startTime

      if (elapsed < spawnDuration && frame % 2 === 0) {
        for (let i = 0; i < perFrame; i++) {
          const color = palette[Math.floor(Math.random() * palette.length)]
          particles.push(new ConfettiParticle(
            Math.random() * canvas.width,
            -15,
            (Math.random() - 0.5) * 2.5,
            2 + Math.random() * 2.5,
            color,
          ))
        }
      }

      particles.forEach(p => { p.update(); p.draw(ctx) })
      particles = particles.filter(p => p.life < PARTICLE_LIFE && p.y < canvas.height + 100)

      if (elapsed >= spawnDuration && particles.length === 0) {
        running = false
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)

    return () => {
      running = false
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', setSize)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [active, rarity])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 60 }}
    />
  )
}
