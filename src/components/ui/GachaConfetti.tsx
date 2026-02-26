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
  common: 2, uncommon: 3, rare: 4, epic: 5, legendary: 6,
}

const SPAWN_MS: Record<GachaRarity, number> = {
  common: 800, uncommon: 1000, rare: 1200, epic: 1600, legendary: 2000,
}

const PARTICLE_LIFE = 2000

// Confetti shapes
type ConfettiShape = 'rect' | 'circle' | 'ribbon'

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
  wobble: number
  wobbleSpeed: number
  shape: ConfettiShape
  opacity: number
  drift: number

  constructor(x: number, y: number, vx: number, vy: number, color: string, canvasWidth: number) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.color = color
    this.life = 0
    this.spin = Math.random() * Math.PI * 2
    this.spinSpeed = (Math.random() - 0.5) * 0.15
    this.size = 6 + Math.random() * 6
    this.wobble = Math.random() * Math.PI * 2
    this.wobbleSpeed = 0.03 + Math.random() * 0.04
    this.shape = (['rect', 'rect', 'circle', 'ribbon'] as ConfettiShape[])[Math.floor(Math.random() * 4)]
    this.opacity = 1
    // Drift towards center of screen for more natural look
    this.drift = (canvasWidth / 2 - x) * 0.0003
  }

  update() {
    this.spin += this.spinSpeed
    this.wobble += this.wobbleSpeed

    // Air resistance
    this.vx *= 0.99
    this.vy *= 0.995

    // Gravity (gentler)
    this.vy += 0.03

    // Horizontal wobble (like real paper falling)
    const wobbleX = Math.sin(this.wobble) * 0.8

    // Slight drift
    this.vx += this.drift

    this.x += this.vx + wobbleX
    this.y += this.vy
    this.life++

    // Fade out near end
    if (this.life > PARTICLE_LIFE - 500) {
      this.opacity = (PARTICLE_LIFE - this.life) / 500
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.opacity

    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.spin)

    // 3D-like rotation effect using scale
    const scaleY = Math.cos(this.wobble * 2) * 0.5 + 0.5
    ctx.scale(1, Math.max(0.2, scaleY))

    ctx.fillStyle = this.color

    switch (this.shape) {
      case 'rect':
        ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2)
        break
      case 'circle':
        ctx.beginPath()
        ctx.arc(0, 0, this.size / 3, 0, Math.PI * 2)
        ctx.fill()
        break
      case 'ribbon':
        ctx.beginPath()
        ctx.moveTo(-this.size / 2, 0)
        ctx.quadraticCurveTo(0, -this.size / 3, this.size / 2, 0)
        ctx.quadraticCurveTo(0, this.size / 3, -this.size / 2, 0)
        ctx.fill()
        break
    }

    ctx.restore()
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

      // Spawn new particles
      if (elapsed < spawnDuration && frame % 3 === 0) {
        for (let i = 0; i < perFrame; i++) {
          const color = palette[Math.floor(Math.random() * palette.length)]
          const spawnX = Math.random() * canvas.width
          particles.push(new ConfettiParticle(
            spawnX,
            -20,
            (Math.random() - 0.5) * 2,
            1.5 + Math.random() * 2,
            color,
            canvas.width,
          ))
        }
      }

      // Update and draw particles
      particles.forEach(p => {
        p.update()
        p.draw(ctx)
      })

      // Remove dead particles
      particles = particles.filter(p => p.life < PARTICLE_LIFE && p.y < canvas.height + 50 && p.opacity > 0)

      // Stop animation when all particles are gone
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
