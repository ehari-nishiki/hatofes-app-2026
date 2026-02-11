import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'

interface PageLoaderProps {
  loading: boolean
  children: React.ReactNode
}

export function PageLoader({ loading, children }: PageLoaderProps) {
  const loaderRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && contentRef.current) {
      // Stagger animation for child elements with data-animate attribute
      const elements = contentRef.current.querySelectorAll('[data-animate]')
      animate(elements, {
        opacity: [0, 1],
        translateY: [30, 0],
        duration: 600,
        delay: stagger(80, { start: 100 }),
        ease: 'outQuart',
      })
    }
  }, [loading])

  if (loading) {
    return (
      <div
        ref={loaderRef}
        className="min-h-screen bg-hatofes-bg flex flex-col items-center justify-center"
      >
        {/* Logo animation */}
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-hatofes-accent-yellow to-hatofes-accent-orange flex items-center justify-center animate-pulse">
            <span className="text-4xl">🕊️</span>
          </div>
          {/* Orbiting dots */}
          <div className="absolute inset-0 animate-spin-slow">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-hatofes-accent-yellow"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${i * 120}deg) translateX(40px) translateY(-50%)`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Loading text with gradient */}
        <div className="text-transparent bg-clip-text bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange font-bold text-lg">
          読み込み中
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-hatofes-dark rounded-full mt-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange rounded-full animate-loading-bar" />
        </div>

        <style>{`
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin-slow {
            animation: spin-slow 3s linear infinite;
          }
          @keyframes loading-bar {
            0% { width: 0%; margin-left: 0; }
            50% { width: 70%; margin-left: 0; }
            100% { width: 0%; margin-left: 100%; }
          }
          .animate-loading-bar {
            animation: loading-bar 1.5s ease-in-out infinite;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div ref={contentRef}>
      {children}
    </div>
  )
}

// Animated card wrapper component
export function AnimatedCard({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cardRef.current) {
      animate(cardRef.current, {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 500,
        delay,
        ease: 'outQuart',
      })
    }
  }, [delay])

  return (
    <div ref={cardRef} className={`opacity-0 ${className}`}>
      {children}
    </div>
  )
}

// Number counter animation component
export function AnimatedNumber({
  value,
  duration = 1000,
  className = '',
}: {
  value: number
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prevValue = useRef(0)

  useEffect(() => {
    if (!ref.current) return

    const obj = { value: prevValue.current }
    animate(obj, {
      value,
      duration,
      round: 1,
      ease: 'outExpo',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = Math.round(obj.value).toLocaleString()
        }
      },
    })
    prevValue.current = value
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
    </span>
  )
}
