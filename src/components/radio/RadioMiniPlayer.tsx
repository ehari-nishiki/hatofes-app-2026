import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { RadioConfig } from '@/types/firestore'

interface RadioMiniPlayerProps {
  config: RadioConfig
  onClose?: () => void
}

export default function RadioMiniPlayer({ config, onClose }: RadioMiniPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const togglePlay = () => {
    if (config.streamType === 'youtube') {
      // YouTube needs to open full player
      return
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  if (!config.isLive && config.streamType !== 'archive') {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-hatofes-dark border-t border-hatofes-gray-lighter safe-area-bottom">
      {/* Hidden audio element for external streams */}
      {config.streamType === 'external' && config.currentStreamUrl && (
        <audio
          ref={audioRef}
          src={config.currentStreamUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Live indicator and info */}
          <Link to="/radio" className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-orange-500">
                <span className="text-lg">📻</span>
              </span>
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-hatofes-white font-bold text-sm truncate">鳩ラジ LIVE</p>
              <p className="text-xs text-hatofes-gray truncate">
                {config.announcement || 'タップして聴く'}
              </p>
            </div>
          </Link>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {config.streamType !== 'youtube' && (
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-hatofes-card flex items-center justify-center text-hatofes-white hover:bg-hatofes-gray-lighter transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            )}

            {config.streamType === 'youtube' && (
              <Link
                to="/radio"
                className="w-10 h-10 rounded-full bg-hatofes-card flex items-center justify-center text-hatofes-white hover:bg-hatofes-gray-lighter transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </Link>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-hatofes-gray hover:text-hatofes-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Audio visualizer when playing */}
        {isPlaying && config.streamType !== 'youtube' && (
          <div className="flex items-center justify-center gap-0.5 h-4 mt-2">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 bg-gradient-to-t from-red-500 to-orange-500 rounded-full animate-audio-bar"
                style={{
                  animationDelay: `${i * 30}ms`,
                  height: '100%',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
