import { useEffect, useState } from 'react';

interface PointRewardModalProps {
  isOpen: boolean;
  points: number;
  reason: string;
  onClose: () => void;
}

export function PointRewardModal({ isOpen, points, reason, onClose }: PointRewardModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowAnimation(true);
      // Auto close after 3 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowAnimation(false);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={`bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center transform transition-all duration-300 ${
          showAnimation ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Animated Icon */}
        <div className="mb-4 flex justify-center">
          <div
            className={`transform transition-transform duration-500 ${
              showAnimation ? 'scale-110 rotate-12' : 'scale-100'
            }`}
          >
            <div className="text-6xl">🎉</div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ポイント獲得！</h2>

        {/* Reason */}
        <p className="text-gray-600 mb-4">{reason}</p>

        {/* Points */}
        <div
          className={`text-5xl font-bold text-primary-600 mb-6 transform transition-all duration-500 ${
            showAnimation ? 'scale-110' : 'scale-100'
          }`}
        >
          +{points}pt
        </div>

        {/* Particle animation */}
        {showAnimation && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 w-2 h-2 bg-primary-400 rounded-full animate-particle"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  '--rotation': `${i * 45}deg`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700 mt-4"
        >
          閉じる
        </button>
      </div>

      <style>{`
        @keyframes particle {
          0% {
            transform: translate(-50%, -50%) rotate(var(--rotation)) translateX(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--rotation)) translateX(100px);
            opacity: 0;
          }
        }
        .animate-particle {
          animation: particle 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
