interface TetrisLoadingProps {
  message?: string
}

export function TetrisLoading({ message = 'Loading...' }: TetrisLoadingProps) {
  return (
    <div className="fixed inset-0 z-50 bg-hatofes-bg flex flex-col items-center justify-center">
      <div className="tetris-wrapper">
        <div className="box-wrap">
          <div className="box one"></div>
          <div className="box two"></div>
          <div className="box three"></div>
          <div className="box four"></div>
          <div className="box five"></div>
          <div className="box six"></div>
        </div>
      </div>

      <p className="mt-8 text-white/60 text-sm font-din tracking-wider">{message}</p>

      <style>{`
        .tetris-wrapper {
          position: relative;
          width: 120px;
          height: 120px;
          background-color: transparent;
          user-select: none;
        }

        .box-wrap {
          width: 70%;
          height: 70%;
          margin: 15% 15%;
          position: relative;
          transform: rotate(-45deg);
        }

        .box {
          width: 100%;
          height: 100%;
          position: absolute;
          left: 0;
          top: 0;
          background: linear-gradient(to right, #141562, #486FBC, #EAB5A1, #8DD6FF, #4973C9, #D07CA7, #F4915E, #F5919E, #B46F89, #141562, #486FBC);
          background-position: 0% 50%;
          background-size: 1000% 1000%;
          visibility: hidden;
        }

        .box.one {
          animation: moveGradient 15s infinite, oneMove 3.5s infinite;
        }
        .box.two {
          animation: moveGradient 15s infinite, twoMove 3.5s 0.15s infinite;
        }
        .box.three {
          animation: moveGradient 15s infinite, threeMove 3.5s 0.3s infinite;
        }
        .box.four {
          animation: moveGradient 15s infinite, fourMove 3.5s 0.575s infinite;
        }
        .box.five {
          animation: moveGradient 15s infinite, fiveMove 3.5s 0.725s infinite;
        }
        .box.six {
          animation: moveGradient 15s infinite, sixMove 3.5s 0.875s infinite;
        }

        @keyframes moveGradient {
          to { background-position: 100% 50%; }
        }

        @keyframes oneMove {
          0% { visibility: visible; clip-path: inset(0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          14.2857% { clip-path: inset(0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          28.5714% { clip-path: inset(35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          42.8571% { clip-path: inset(35% 70% 35% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          57.1428% { clip-path: inset(35% 70% 35% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          71.4285% { clip-path: inset(0% 70% 70% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          85.7142% { clip-path: inset(0% 70% 70% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          100% { clip-path: inset(0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
        }

        @keyframes twoMove {
          0% { visibility: visible; clip-path: inset(0% 70% 70% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          14.2857% { clip-path: inset(0% 70% 70% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          28.5714% { clip-path: inset(0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          42.8571% { clip-path: inset(0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          57.1428% { clip-path: inset(35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          71.4285% { clip-path: inset(35% 70% 35% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          85.7142% { clip-path: inset(35% 70% 35% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          100% { clip-path: inset(0% 70% 70% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
        }

        @keyframes threeMove {
          0% { visibility: visible; clip-path: inset(35% 70% 35% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          14.2857% { clip-path: inset(35% 70% 35% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          28.5714% { clip-path: inset(0% 70% 70% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          42.8571% { clip-path: inset(0% 70% 70% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          57.1428% { clip-path: inset(0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          71.4285% { clip-path: inset(0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          85.7142% { clip-path: inset(35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          100% { clip-path: inset(35% 70% 35% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
        }

        @keyframes fourMove {
          0% { visibility: visible; clip-path: inset(35% 0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          14.2857% { clip-path: inset(35% 0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          28.5714% { clip-path: inset(35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          42.8571% { clip-path: inset(70% 35% 0% 35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          57.1428% { clip-path: inset(70% 35% 0% 35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          71.4285% { clip-path: inset(70% 0 0 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          85.7142% { clip-path: inset(70% 0 0 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          100% { clip-path: inset(35% 0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
        }

        @keyframes fiveMove {
          0% { visibility: visible; clip-path: inset(70% 0 0 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          14.2857% { clip-path: inset(70% 0 0 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          28.5714% { clip-path: inset(35% 0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          42.8571% { clip-path: inset(35% 0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          57.1428% { clip-path: inset(35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          71.4285% { clip-path: inset(70% 35% 0% 35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          85.7142% { clip-path: inset(70% 35% 0% 35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          100% { clip-path: inset(70% 0 0 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
        }

        @keyframes sixMove {
          0% { visibility: visible; clip-path: inset(70% 35% 0% 35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          14.2857% { clip-path: inset(70% 35% 0% 35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          28.5714% { clip-path: inset(70% 0 0 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          42.8571% { clip-path: inset(70% 0 0 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          57.1428% { clip-path: inset(35% 0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          71.4285% { clip-path: inset(35% 0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          85.7142% { clip-path: inset(35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
          100% { clip-path: inset(70% 35% 0% 35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
        }
      `}</style>
    </div>
  )
}
