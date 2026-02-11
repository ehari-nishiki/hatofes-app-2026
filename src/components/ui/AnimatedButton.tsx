import { useRef, useState, useEffect } from 'react'
import { animate } from 'animejs'

interface AnimatedButtonProps {
  children: React.ReactNode
  onClick?: () => void | Promise<void>
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'gradient'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  loadingText?: string
}

export function AnimatedButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  className = '',
  loadingText,
}: AnimatedButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rippleRef = useRef<HTMLDivElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRipple, setShowRipple] = useState(false)

  const isLoading = loading || isProcessing

  useEffect(() => {
    if (isLoading && buttonRef.current) {
      // Pulse animation while loading
      animate(buttonRef.current, {
        boxShadow: [
          '0 0 0 0 rgba(255, 195, 0, 0)',
          '0 0 0 10px rgba(255, 195, 0, 0.3)',
          '0 0 0 0 rgba(255, 195, 0, 0)',
        ],
        duration: 1500,
        loop: true,
        ease: 'inOutSine',
      })
    }
  }, [isLoading])

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return

    // Ripple effect
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect && rippleRef.current) {
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      rippleRef.current.style.left = `${x}px`
      rippleRef.current.style.top = `${y}px`
      setShowRipple(true)

      animate(rippleRef.current, {
        scale: [0, 4],
        opacity: [0.5, 0],
        duration: 600,
        ease: 'outQuart',
        onComplete: () => setShowRipple(false),
      })
    }

    // Press animation
    if (buttonRef.current) {
      animate(buttonRef.current, {
        scale: [1, 0.95, 1],
        duration: 200,
        ease: 'inOutQuad',
      })
    }

    if (onClick) {
      const result = onClick()
      if (result instanceof Promise) {
        setIsProcessing(true)
        try {
          await result
        } finally {
          setIsProcessing(false)
        }
      }
    }
  }

  const baseClasses = `
    relative overflow-hidden font-bold transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    flex items-center justify-center gap-2
  `

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm rounded-lg',
    md: 'px-6 py-3 text-base rounded-lg',
    lg: 'px-8 py-4 text-lg rounded-xl',
  }

  const variantClasses = {
    primary: 'bg-hatofes-accent-yellow text-black hover:bg-hatofes-accent-yellow/90',
    secondary: 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow',
    gradient: 'bg-gradient-to-r from-hatofes-accent-orange to-hatofes-accent-yellow text-white hover:opacity-90',
  }

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {/* Ripple effect */}
      <div
        ref={rippleRef}
        className={`absolute w-10 h-10 rounded-full bg-white/30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 ${
          showRipple ? 'block' : 'hidden'
        }`}
      />

      {/* Content */}
      <span
        className={`transition-all duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      >
        {children}
      </span>

      {/* Loading spinner */}
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {loadingText && <span className="text-sm">{loadingText}</span>}
        </span>
      )}

      {/* Gradient overlay for gradient variant */}
      {variant === 'gradient' && (
        <div
          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            animation: 'shimmer 2s infinite',
          }}
        />
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </button>
  )
}
