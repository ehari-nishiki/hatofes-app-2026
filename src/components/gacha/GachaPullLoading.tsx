interface GachaPullLoadingProps {
  active: boolean
  pullCount: 1 | 10
}

export function GachaPullLoading({ active, pullCount }: GachaPullLoadingProps) {
  if (!active) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center overflow-hidden">
      {/* Wave loading animation */}
      <div className="loading-wave">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <p className="relative z-10 mt-8 text-white/80 text-lg font-din tracking-wider animate-pulse">
        {pullCount === 10 ? 'Summoning 10 cards...' : 'Summoning card...'}
      </p>

      <style>{`
        .loading-wave {
          position: relative;
          width: 160px;
          height: 160px;
          filter: contrast(1.2);
        }

        .loading-wave span {
          mix-blend-mode: screen;
          display: block;
          position: absolute;
          border-radius: 50%;
          animation: wave 3s infinite linear;
        }

        .loading-wave span:nth-child(1) {
          left: -11%;
          right: -2%;
          top: -12%;
          bottom: -5%;
          transform-origin: 46% 53%;
          animation-delay: 0s;
          background-color: hsl(45, 100%, 50%);
        }

        .loading-wave span:nth-child(2) {
          left: -4%;
          right: -4%;
          top: -9%;
          bottom: -2%;
          transform-origin: 47% 50%;
          animation-delay: -0.5s;
          background-color: hsl(35, 100%, 50%);
        }

        .loading-wave span:nth-child(3) {
          left: -11%;
          right: -4%;
          top: -10%;
          bottom: -11%;
          transform-origin: 49% 53%;
          animation-delay: -1s;
          background-color: hsl(25, 100%, 50%);
        }

        .loading-wave span:nth-child(4) {
          left: -7%;
          right: -9%;
          top: -11%;
          bottom: -4%;
          transform-origin: 47% 52%;
          animation-delay: -1.5s;
          background-color: hsl(15, 100%, 50%);
        }

        .loading-wave span:nth-child(5) {
          left: -8%;
          right: -3%;
          top: -5%;
          bottom: -11%;
          transform-origin: 47% 52%;
          animation-delay: -2s;
          background-color: hsl(40, 100%, 55%);
        }

        .loading-wave span:nth-child(6) {
          left: -10%;
          right: -8%;
          top: -4%;
          bottom: -9%;
          transform-origin: 48% 51%;
          animation-delay: -2.5s;
          background-color: hsl(30, 100%, 45%);
        }

        .loading-wave span:nth-child(7) {
          left: -9%;
          right: -11%;
          top: -5%;
          bottom: -8%;
          transform-origin: 47% 50%;
          animation-delay: -3s;
          background-color: hsl(50, 100%, 50%);
        }

        @keyframes wave {
          from { transform: rotateZ(0deg); }
          to { transform: rotateZ(360deg); }
        }
      `}</style>
    </div>
  )
}
