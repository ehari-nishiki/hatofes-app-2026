import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'

interface FlyingPointsProps {
  points: number
  fromRect?: DOMRect | null // Source element position
  targetSelector?: string // CSS selector for target (default: header point display)
  onComplete?: () => void
}

export function FlyingPoints({ points, fromRect, targetSelector = '.header-points', onComplete }: FlyingPointsProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!fromRect) return

    const target = document.querySelector(targetSelector)
    const targetRect = target?.getBoundingClientRect()
    if (!targetRect) {
      onComplete?.()
      return
    }

    const count = Math.min(points, 8)
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: fromRect.left + fromRect.width / 2 + (Math.random() - 0.5) * 40,
      y: fromRect.top + fromRect.height / 2 + (Math.random() - 0.5) * 20,
    }))
    setParticles(newParticles)

    // Animate after render
    requestAnimationFrame(() => {
      const els = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('.flying-point') ?? [])
      if (!els.length) return

      let completedCount = 0
      els.forEach((el, i) => {
        const particle = newParticles[i]
        animate(el, {
          translateX: [0, targetRect.left + targetRect.width / 2 - particle.x],
          translateY: [0, targetRect.top + targetRect.height / 2 - particle.y],
          scale: [1, 0.5],
          opacity: [1, 0],
          duration: 600,
          delay: i * 50,
          ease: 'inOutQuad',
          onComplete: () => {
            completedCount += 1
            if (completedCount === els.length) {
              setParticles([])
              onComplete?.()
            }
          },
        })
      })
    })
  }, [fromRect, targetSelector, points, onComplete])

  if (particles.length === 0) return null

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[100]">
      {particles.map((p) => (
        <div
          key={p.id}
          className="flying-point absolute w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            left: p.x,
            top: p.y,
            background: 'linear-gradient(135deg, #FFC300, #FF4E00)',
            color: 'white',
            boxShadow: '0 0 8px rgba(255, 195, 0, 0.6)',
          }}
        >
          +
        </div>
      ))}
    </div>
  )
}
