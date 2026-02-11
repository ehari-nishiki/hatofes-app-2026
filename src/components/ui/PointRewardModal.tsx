import { useEffect, useState, useRef } from 'react';
import { CONFETTI_COLORS, GRADIENT_STYLES } from '@/lib/animations';

interface PointRewardModalProps {
  isOpen: boolean;
  points: number;
  reason: string;
  onClose: () => void;
  unit?: string;
  title?: string;
}

export function PointRewardModal({ isOpen, points, reason, onClose, unit = 'pt', title = 'ポイント獲得！' }: PointRewardModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShowAnimation(true);
      startConfetti();
      // Auto close after 3 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => {
        clearTimeout(timer);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setShowAnimation(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [isOpen, onClose]);

  const startConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      rotation: number;
      rotationSpeed: number;
      life: number;
      maxLife: number;
    }

    const particles: Particle[] = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Create particles
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80 + Math.random() * 0.5;
      const velocity = 6 + Math.random() * 12;

      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 4,
        color: CONFETTI_COLORS.celebration[Math.floor(Math.random() * CONFETTI_COLORS.celebration.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 80 + Math.random() * 40,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;
        p.life++;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        // Draw rectangle confetti
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      ctx.globalAlpha = 1;

      if (particles.length > 0) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Confetti Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-60" />

      <div
        className={`bg-hatofes-dark border border-hatofes-gray rounded-2xl p-8 max-w-sm w-full mx-4 text-center relative transform transition-all duration-300 z-50 ${
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
        <h2 className="text-2xl font-bold text-hatofes-white mb-2">{title}</h2>

        {/* Reason */}
        <p className="text-hatofes-gray mb-4">{reason}</p>

        {/* Points - DINフォント＋グラデーション */}
        <div
          className={`text-5xl font-bold mb-6 transform transition-all duration-500 font-display ${
            showAnimation ? 'scale-110' : 'scale-100'
          }`}
          style={GRADIENT_STYLES.gold as React.CSSProperties}
        >
          +{points}<span className="text-2xl ml-1">{unit}</span>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="text-sm text-hatofes-gray hover:text-hatofes-white mt-4"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
