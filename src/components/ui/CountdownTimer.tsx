import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Timestamp } from 'firebase/firestore'

interface FestivalConfig {
  startDate: Timestamp
  endDate: Timestamp
  countdownEnabled: boolean
  message?: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

type FestivalStatus = 'before' | 'live' | 'ended'

interface CountdownTimerProps {
  variant?: 'default' | 'compact' | 'hero'
  showMessage?: boolean
  className?: string
}

export default function CountdownTimer({
  variant = 'default',
  showMessage = true,
  className = '',
}: CountdownTimerProps) {
  const [config, setConfig] = useState<FestivalConfig | null>(null)
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [status, setStatus] = useState<FestivalStatus>('before')
  const [loading, setLoading] = useState(true)

  // Subscribe to festival config
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'config', 'festivalDate'),
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig(snapshot.data() as FestivalConfig)
        }
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching festival config:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Calculate time left
  useEffect(() => {
    if (!config || !config.countdownEnabled) return

    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const startTime = config.startDate.toDate().getTime()
      const endTime = config.endDate.toDate().getTime()

      if (now >= endTime) {
        setStatus('ended')
        setTimeLeft(null)
        return
      }

      if (now >= startTime) {
        setStatus('live')
        // Show countdown to end during the festival
        const diff = endTime - now
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
          total: diff,
        })
        return
      }

      // Before festival
      setStatus('before')
      const diff = startTime - now
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        total: diff,
      })
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [config])

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-16 bg-hatofes-dark rounded-lg" />
      </div>
    )
  }

  if (!config || !config.countdownEnabled) {
    return null
  }

  // Ended state
  if (status === 'ended') {
    return (
      <div className={`text-center ${className}`}>
        <div className="bg-gradient-to-r from-hatofes-accent-yellow/20 to-hatofes-accent-orange/20 rounded-lg p-6 border border-hatofes-accent-yellow/30">
          <p className="text-xl font-bold text-hatofes-white mb-2">
            ご参加ありがとうございました
          </p>
          {showMessage && config.message && (
            <p className="text-sm text-hatofes-gray">{config.message}</p>
          )}
        </div>
      </div>
    )
  }

  // Live state
  if (status === 'live') {
    return (
      <div className={`${className}`}>
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20 border border-red-500/50 p-4">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-yellow-500/10 animate-pulse" />

          <div className="relative z-10">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-2xl font-bold text-gradient-live font-display tracking-wider animate-pulse">
                NOW LIVE
              </span>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            </div>

            {showMessage && config.message && (
              <p className="text-center text-sm text-hatofes-white">{config.message}</p>
            )}

            {variant !== 'compact' && timeLeft && (
              <div className="mt-3 text-center">
                <p className="text-xs text-hatofes-gray mb-1">終了まで</p>
                <div className="flex justify-center gap-2">
                  {timeLeft.days > 0 && (
                    <TimeUnit value={timeLeft.days} label="日" size="sm" />
                  )}
                  <TimeUnit value={timeLeft.hours} label="時間" size="sm" />
                  <TimeUnit value={timeLeft.minutes} label="分" size="sm" />
                  <TimeUnit value={timeLeft.seconds} label="秒" size="sm" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Before state - countdown
  if (!timeLeft) return null

  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-center gap-1 text-sm ${className}`}>
        <span className="text-hatofes-gray">開幕まで</span>
        <span className="font-bold text-hatofes-accent-yellow font-din">
          {timeLeft.days}日 {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    )
  }

  if (variant === 'hero') {
    return (
      <div className={`text-center ${className}`}>
        <p className="text-hatofes-gray text-sm mb-4 font-display tracking-wide">
          COUNTDOWN TO HATOFES
        </p>
        <div className="flex justify-center gap-4 md:gap-6">
          <TimeUnit value={timeLeft.days} label="DAYS" size="lg" />
          <span className="text-4xl text-hatofes-accent-yellow self-center animate-pulse">:</span>
          <TimeUnit value={timeLeft.hours} label="HOURS" size="lg" />
          <span className="text-4xl text-hatofes-accent-yellow self-center animate-pulse">:</span>
          <TimeUnit value={timeLeft.minutes} label="MINS" size="lg" />
          <span className="text-4xl text-hatofes-accent-yellow self-center animate-pulse">:</span>
          <TimeUnit value={timeLeft.seconds} label="SECS" size="lg" />
        </div>
        {showMessage && config.message && (
          <p className="mt-4 text-sm text-hatofes-gray">{config.message}</p>
        )}
      </div>
    )
  }

  // Default variant
  return (
    <div className={`${className}`}>
      <div className="bg-hatofes-card border border-hatofes-gray-lighter rounded-lg p-4">
        <p className="text-center text-hatofes-gray text-xs mb-3 font-display tracking-wide">
          鳩祭開幕まで
        </p>
        <div className="flex justify-center gap-3">
          <TimeUnit value={timeLeft.days} label="日" />
          <TimeUnit value={timeLeft.hours} label="時間" />
          <TimeUnit value={timeLeft.minutes} label="分" />
          <TimeUnit value={timeLeft.seconds} label="秒" />
        </div>
        {showMessage && config.message && (
          <p className="mt-3 text-center text-sm text-hatofes-gray">{config.message}</p>
        )}
      </div>
    </div>
  )
}

interface TimeUnitProps {
  value: number
  label: string
  size?: 'sm' | 'md' | 'lg'
}

function TimeUnit({ value, label, size = 'md' }: TimeUnitProps) {
  const sizeClasses = {
    sm: 'text-lg w-12',
    md: 'text-2xl w-14',
    lg: 'text-4xl md:text-5xl w-20 md:w-24',
  }

  const labelClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-xs md:text-sm',
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className={`${sizeClasses[size]} bg-hatofes-dark rounded-lg flex items-center justify-center font-bold font-din text-hatofes-white`}
        style={{
          aspectRatio: size === 'lg' ? '1' : 'auto',
          padding: size === 'lg' ? '0' : '0.5rem',
        }}
      >
        {String(value).padStart(2, '0')}
      </div>
      <span className={`${labelClasses[size]} text-hatofes-gray mt-1`}>{label}</span>
    </div>
  )
}

// Add gradient animation styles
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  .text-gradient-live {
    background: linear-gradient(90deg, #ff4757, #ffa502, #ff4757);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: gradient-live 2s linear infinite;
  }
  @keyframes gradient-live {
    0% { background-position: 0% center; }
    100% { background-position: 200% center; }
  }
`
if (!document.querySelector('#countdown-timer-styles')) {
  styleSheet.id = 'countdown-timer-styles'
  document.head.appendChild(styleSheet)
}
