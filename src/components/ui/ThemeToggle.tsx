import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const { theme: actualTheme, setTheme: setActualTheme } = useTheme()
  // displayTheme is used only for visual flicker effect during transition
  const [displayTheme, setDisplayTheme] = useState<'light' | 'dark'>(actualTheme)
  const [isFlickering, setIsFlickering] = useState(false)

  // Keep display in sync with actual theme (e.g. on load from Firestore)
  useEffect(() => {
    if (!isFlickering) {
      setDisplayTheme(actualTheme)
    }
  }, [actualTheme, isFlickering])

  const toggleTheme = () => {
    const newTheme = actualTheme === 'dark' ? 'light' : 'dark'

    if (newTheme === 'light') {
      setIsFlickering(true)
      setTimeout(() => setDisplayTheme('light'), 100)
      setTimeout(() => setDisplayTheme('dark'), 200)
      setTimeout(() => setDisplayTheme('light'), 250)
      setTimeout(() => setDisplayTheme('dark'), 350)
      setTimeout(() => setDisplayTheme('light'), 400)
      setTimeout(() => setDisplayTheme('dark'), 500)
      setTimeout(() => {
        setDisplayTheme('light')
        setIsFlickering(false)
        setActualTheme('light') // localStorage + Firestore に保存
      }, 600)
    } else {
      setActualTheme('dark') // localStorage + Firestore に保存
    }
  }

  return (
    <div className="theme-toggle-wrapper">
      <button
        className={`theme-toggle-bulb ${isFlickering ? 'flickering-bulb' : ''}`}
        onClick={toggleTheme}
        disabled={isFlickering}
        aria-label="テーマ切り替え"
        title={`${actualTheme === 'dark' ? 'ライト' : 'ダーク'}モードに切り替え`}
      >
        {/* 天井マウント */}
        <div className="ceiling-mount">
          <div className="ceiling-plate" />
        </div>

        <div className="swing-frame">
          <div className="cord-wrapper">
            <div className="cord" />
            <div className="cord-shadow" />
          </div>

          {/* 電球本体 */}
          <div className="bulb-body">
            <svg
              viewBox="0 0 140 220"
              className={`bulb-svg ${displayTheme === 'light' ? 'bulb-on' : ''} ${isFlickering ? 'flickering' : ''}`}
            >
              <defs>
                <radialGradient id="glass-main" cx="35%" cy="30%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                  <stop offset="30%" stopColor="rgba(248,250,255,0.85)" />
                  <stop offset="60%" stopColor="rgba(235,240,250,0.75)" />
                  <stop offset="85%" stopColor="rgba(220,230,245,0.65)" />
                  <stop offset="100%" stopColor="rgba(200,215,235,0.55)" />
                </radialGradient>

                <linearGradient id="glass-rim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(180,200,220,0.8)" />
                  <stop offset="50%" stopColor="rgba(200,220,240,0.6)" />
                  <stop offset="100%" stopColor="rgba(180,200,220,0.8)" />
                </linearGradient>

                <radialGradient id="highlight-sharp" cx="30%" cy="25%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                  <stop offset="40%" stopColor="rgba(255,255,255,0.4)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>

                <radialGradient id="inner-light" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="rgba(255,248,220,1)" />
                  <stop offset="25%" stopColor="rgba(255,235,150,0.95)" />
                  <stop offset="50%" stopColor="rgba(255,215,100,0.8)" />
                  <stop offset="75%" stopColor="rgba(255,200,80,0.4)" />
                  <stop offset="100%" stopColor="rgba(255,180,50,0)" />
                </radialGradient>

                <linearGradient id="metal-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#5A5A5A" />
                  <stop offset="25%" stopColor="#6E6E6E" />
                  <stop offset="50%" stopColor="#4A4A4A" />
                  <stop offset="75%" stopColor="#5E5E5E" />
                  <stop offset="100%" stopColor="#3E3E3E" />
                </linearGradient>

                <filter id="glass-blur">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
                </filter>
                <filter id="glow-blur">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                </filter>
              </defs>

              <g className="socket-group">
                <rect x="50" y="10" width="40" height="12" fill="url(#metal-gradient)" rx="2" />
                <rect x="48" y="22" width="44" height="10" fill="#5A5A5A" rx="1.5" />
                <rect x="46" y="32" width="48" height="10" fill="url(#metal-gradient)" rx="1.5" />
                {[24, 27, 30, 35, 38, 41].map((y) => (
                  <line key={y} x1="46" y1={y} x2="94" y2={y} stroke="#3A3A3A" strokeWidth="0.8" opacity="0.6" />
                ))}
                <rect x="50" y="10" width="15" height="8" fill="rgba(255,255,255,0.15)" rx="1" />
              </g>

              <ellipse cx="70" cy="100" rx="44" ry="58" fill="rgba(0,0,0,0.08)" transform="translate(2, 3)" filter="url(#glass-blur)" />
              <ellipse cx="70" cy="100" rx="44" ry="58" fill="url(#glass-main)" className="main-glass" opacity="0.92" />
              <ellipse cx="70" cy="100" rx="44" ry="58" fill="none" stroke="url(#glass-rim)" strokeWidth="1.5" className="glass-edge" />
              <ellipse cx="52" cy="70" rx="22" ry="35" fill="url(#highlight-sharp)" className="main-highlight" />
              <ellipse cx="85" cy="85" rx="10" ry="22" fill="rgba(255,255,255,0.4)" className="sub-highlight" />
              <ellipse cx="70" cy="135" rx="30" ry="15" fill="rgba(255,255,255,0.15)" className="bottom-reflection" />

              <g className="filament-group">
                <line x1="70" y1="50" x2="70" y2="65" stroke="#8B7355" strokeWidth="1" opacity="0.7" />
                <line x1="70" y1="115" x2="70" y2="130" stroke="#8B7355" strokeWidth="1" opacity="0.7" />
                <path
                  d="M 70 65 Q 62 70, 70 75 Q 78 70, 70 75 Q 62 80, 70 85 Q 78 80, 70 85 Q 62 90, 70 95 Q 78 90, 70 95 Q 62 100, 70 105 Q 78 100, 70 105 Q 62 110, 70 115"
                  fill="none" stroke="#6B5D4F" strokeWidth="2.5" opacity="0.8" className="filament-wire"
                />
                <path
                  d="M 70 65 Q 62 70, 70 75 Q 78 70, 70 75 Q 62 80, 70 85 Q 78 80, 70 85 Q 62 90, 70 95 Q 78 90, 70 95 Q 62 100, 70 105 Q 78 100, 70 105 Q 62 110, 70 115"
                  fill="none" stroke="#FFE55C" strokeWidth="1.8" opacity="0" className="filament-glow"
                />
              </g>

              <ellipse cx="70" cy="95" rx="38" ry="50" fill="url(#inner-light)" className="inner-glow" opacity="0" filter="url(#glow-blur)" />
              <ellipse cx="70" cy="100" rx="43" ry="57" fill="rgba(255,255,255,0.03)" className="glass-frost" />
            </svg>

            <div className={`light-aura ${displayTheme === 'light' ? 'active' : ''}`}>
              <div className="aura-inner" />
              <div className="aura-outer" />
            </div>
          </div>
        </div>
      </button>

      <style>{`
        .theme-toggle-wrapper {
          position: relative;
          z-index: 100;
        }

        .theme-toggle-bulb {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          width: 50px;
          height: 90px;
          position: relative;
        }

        .theme-toggle-bulb:disabled {
          cursor: not-allowed;
        }

        .theme-toggle-bulb:focus {
          outline: none;
        }

        .theme-toggle-bulb:hover:not(:disabled) .swing-frame {
          animation: pendulum-hover 2s ease-in-out infinite;
        }

        .swing-frame {
          position: absolute;
          top: 8px;
          left: 50%;
          width: 44px;
          height: 82px;
          transform: translateX(-50%);
          transform-origin: center top;
          animation: pendulum-idle 3.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        .ceiling-mount {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
        }

        .ceiling-plate {
          width: 32px;
          height: 8px;
          background: linear-gradient(180deg, #2A2A2A 0%, #1A1A1A 100%);
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
          margin: 0 auto;
        }

        .cord-wrapper {
          position: relative;
          width: 14px;
          height: 22px;
          margin: 0 auto;
          overflow: visible;
        }

        .cord {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 2.5px;
          height: 100%;
          background: linear-gradient(90deg, #4A4A4A 0%, #6A6A6A 50%, #4A4A4A 100%);
          box-shadow: inset -1px 0 1px rgba(0,0,0,0.5), 1px 0 1px rgba(255,255,255,0.1);
          border-radius: 2px;
          transform-origin: center top;
          animation: cord-idle 3.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        .cord-shadow {
          position: absolute;
          top: 0;
          left: 8px;
          width: 1px;
          height: 100%;
          background: rgba(0,0,0,0.2);
          filter: blur(1px);
          transform-origin: center top;
          animation: cord-idle 3.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        .theme-toggle-bulb:hover:not(:disabled) .cord,
        .theme-toggle-bulb:hover:not(:disabled) .cord-shadow {
          animation: cord-hover 2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        .bulb-body {
          position: relative;
          width: 100%;
          height: calc(100% - 18px);
          margin-top: -2px;
        }

        .bulb-svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 6px 12px rgba(0,0,0,0.25));
          transition: filter 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .main-glass { transition: opacity 0.3s ease; }
        .glass-edge { opacity: 0.6; transition: opacity 0.3s ease; }
        .main-highlight { transition: opacity 0.3s ease; }
        .sub-highlight { transition: opacity 0.3s ease; }
        .glass-frost { mix-blend-mode: overlay; }

        .bulb-svg.bulb-on {
          filter:
            drop-shadow(0 0 25px rgba(255,220,100,0.6))
            drop-shadow(0 0 45px rgba(255,200,80,0.4))
            drop-shadow(0 6px 12px rgba(0,0,0,0.2));
        }
        .bulb-svg.bulb-on .main-glass { opacity: 0.85; }
        .bulb-svg.bulb-on .glass-edge { opacity: 0.4; }
        .bulb-svg.bulb-on .main-highlight { opacity: 1.2; }
        .bulb-svg.bulb-on .filament-glow {
          opacity: 1;
          animation: filament-shimmer 2.5s ease-in-out infinite;
        }
        .bulb-svg.bulb-on .inner-glow {
          opacity: 0.85;
          animation: light-pulse 3s ease-in-out infinite;
        }

        .bulb-svg.flickering .filament-glow { animation: flicker-on 0.6s linear; }
        .bulb-svg.flickering .inner-glow { animation: flicker-on 0.6s linear; }

        .light-aura {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: 100px;
          height: 100px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        .light-aura.active { opacity: 1; }
        .aura-inner {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(255,240,180,0.6) 0%, rgba(255,220,120,0.4) 30%, rgba(255,200,80,0.2) 60%, transparent 100%);
          border-radius: 50%;
          filter: blur(8px);
          animation: aura-pulse-inner 3s ease-in-out infinite;
        }
        .aura-outer {
          position: absolute;
          inset: -20px;
          background: radial-gradient(circle, rgba(255,230,150,0.3) 0%, rgba(255,210,100,0.15) 40%, transparent 70%);
          border-radius: 50%;
          filter: blur(15px);
          animation: aura-pulse-outer 4s ease-in-out infinite;
        }

        @keyframes pendulum-idle {
          0%   { transform: translateX(-50%) rotateZ(0deg); }
          20%  { transform: translateX(-50%) rotateZ(3.2deg); }
          50%  { transform: translateX(-50%) rotateZ(0.4deg); }
          75%  { transform: translateX(-50%) rotateZ(-2.8deg); }
          100% { transform: translateX(-50%) rotateZ(0deg); }
        }

        @keyframes pendulum-hover {
          0%   { transform: translateX(-50%) rotateZ(0deg); }
          20%  { transform: translateX(-50%) rotateZ(6deg); }
          50%  { transform: translateX(-50%) rotateZ(0.6deg); }
          75%  { transform: translateX(-50%) rotateZ(-5.4deg); }
          100% { transform: translateX(-50%) rotateZ(0deg); }
        }

        @keyframes cord-idle {
          0%   { transform: translateX(-50%) skewX(0deg) scaleY(1); }
          20%  { transform: translateX(-50%) skewX(-5deg) scaleY(1.01); }
          50%  { transform: translateX(-50%) skewX(-1deg) scaleY(1); }
          75%  { transform: translateX(-50%) skewX(4deg) scaleY(1.01); }
          100% { transform: translateX(-50%) skewX(0deg) scaleY(1); }
        }

        @keyframes cord-hover {
          0%   { transform: translateX(-50%) skewX(0deg) scaleY(1); }
          20%  { transform: translateX(-50%) skewX(-8deg) scaleY(1.02); }
          50%  { transform: translateX(-50%) skewX(-1.5deg) scaleY(1); }
          75%  { transform: translateX(-50%) skewX(7deg) scaleY(1.02); }
          100% { transform: translateX(-50%) skewX(0deg) scaleY(1); }
        }

        @keyframes filament-shimmer {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 4px #FFD700); }
          50%       { opacity: 0.95; filter: drop-shadow(0 0 6px #FFE55C); }
        }

        @keyframes light-pulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50%       { opacity: 0.9; transform: scale(1.05); }
        }

        @keyframes aura-pulse-inner {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.85; transform: scale(1.08); }
        }

        @keyframes aura-pulse-outer {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50%       { opacity: 1; transform: scale(1.12); }
        }

        @keyframes flicker-on {
          0%, 15%, 30%, 45%, 60%, 80% { opacity: 0; }
          10%, 25%, 40%, 55%, 75%, 100% { opacity: 1; }
        }

        @media (max-width: 768px) {
          .theme-toggle-bulb { width: 45px; height: 80px; }
          .swing-frame { width: 40px; height: 72px; }
          .light-aura { width: 80px; height: 80px; }
        }
      `}</style>
    </div>
  )
}
