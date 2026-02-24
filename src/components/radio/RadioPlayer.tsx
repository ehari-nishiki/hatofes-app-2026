import { useState, useRef, useEffect } from 'react'
import type { RadioConfig } from '@/types/firestore'

interface RadioPlayerProps {
  config: RadioConfig
  onMinimize?: () => void
}

export default function RadioPlayer({ config, onMinimize }: RadioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Handle play/pause for audio streams
  const togglePlay = () => {
    if (config.streamType === 'youtube') {
      // YouTube is handled by iframe API
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

  // Handle volume change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  // Extract YouTube video ID
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return match ? match[1] : null
  }

  if (!config.isLive && config.streamType !== 'archive') {
    return (
      <div className="bg-hatofes-dark rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">📻</div>
        <p className="text-hatofes-white font-bold mb-1">鳩ラジ</p>
        <p className="text-hatofes-gray text-sm">
          {config.announcement || '現在放送していません'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-hatofes-dark rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 p-4 border-b border-hatofes-gray-lighter">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <div>
              <p className="text-hatofes-white font-bold">鳩ラジ LIVE</p>
              {config.announcement && (
                <p className="text-xs text-hatofes-gray">{config.announcement}</p>
              )}
            </div>
          </div>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-2 text-hatofes-gray hover:text-hatofes-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Player Content */}
      <div className="p-4">
        {/* YouTube Embed */}
        {config.streamType === 'youtube' && config.currentStreamUrl && (
          <div className="aspect-video rounded-lg overflow-hidden bg-black mb-4">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${getYouTubeId(config.currentStreamUrl)}?autoplay=0&rel=0`}
              title="鳩ラジ Live"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* External Audio Stream */}
        {config.streamType === 'external' && config.currentStreamUrl && (
          <>
            <audio
              ref={audioRef}
              src={config.currentStreamUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <div className="flex items-center justify-center gap-4 py-4">
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center text-white hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Volume Control */}
              <div className="relative">
                <button
                  onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                  className="p-2 text-hatofes-gray hover:text-hatofes-white transition-colors"
                >
                  {volume === 0 ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                {showVolumeSlider && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-hatofes-card p-2 rounded-lg shadow-lg">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-24 h-2 accent-hatofes-accent-yellow"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Audio Visualizer Placeholder */}
            <div className="flex items-center justify-center gap-1 h-8">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 bg-gradient-to-t from-red-500 to-orange-500 rounded-full transition-all ${
                    isPlaying ? 'animate-audio-bar' : 'h-1'
                  }`}
                  style={{
                    animationDelay: `${i * 50}ms`,
                    height: isPlaying ? `${Math.random() * 100}%` : '4px',
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Archive Audio */}
        {config.streamType === 'archive' && config.currentStreamUrl && (
          <>
            <audio
              ref={audioRef}
              src={config.currentStreamUrl}
              controls
              className="w-full"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </>
        )}
      </div>
    </div>
  )
}

// Add animation styles
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes audio-bar {
    0%, 100% { height: 10%; }
    50% { height: 100%; }
  }
  .animate-audio-bar {
    animation: audio-bar 0.5s ease-in-out infinite;
  }
`
if (!document.querySelector('#radio-player-styles')) {
  styleSheet.id = 'radio-player-styles'
  document.head.appendChild(styleSheet)
}
