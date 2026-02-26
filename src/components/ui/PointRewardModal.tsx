import { useEffect, useState, useRef, useCallback } from 'react';
import { CONFETTI_COLORS, GRADIENT_STYLES } from '@/lib/animations';

interface PointRewardModalProps {
  isOpen: boolean;
  points: number;
  reason: string;
  onClose: () => void;
  unit?: string;
  title?: string;
}

type ConfettiShape = 'rect' | 'circle' | 'star';

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
  shape: ConfettiShape;
  wobble: number;
  wobbleSpeed: number;
  scalePhase: number;
}

export function PointRewardModal({ isOpen, points, reason, onClose, unit = 'pt', title = 'ポイント獲得!' }: PointRewardModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  const startConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Create particles in bursts from center
    const totalParticles = 60;
    const shapes: ConfettiShape[] = ['rect', 'rect', 'circle', 'star'];

    for (let i = 0; i < totalParticles; i++) {
      // Spread particles in a cone upward with some randomness
      const angle = (Math.PI * 1.5) + (Math.random() - 0.5) * Math.PI * 0.8;
      const velocity = 8 + Math.random() * 10;

      particles.push({
        x: centerX + (Math.random() - 0.5) * 40,
        y: centerY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * velocity + (Math.random() - 0.5) * 3,
        vy: Math.sin(angle) * velocity,
        color: CONFETTI_COLORS.celebration[Math.floor(Math.random() * CONFETTI_COLORS.celebration.length)],
        size: 5 + Math.random() * 7,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        life: 0,
        maxLife: 100 + Math.random() * 60,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.05,
        scalePhase: Math.random() * Math.PI * 2,
      });
    }

    particlesRef.current = particles;

    const drawStar = (ctx: CanvasRenderingContext2D, size: number) => {
      const spikes = 5;
      const outerRadius = size / 2;
      const innerRadius = size / 4;

      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        if (i === 0) {
          ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        } else {
          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
      }
      ctx.closePath();
      ctx.fill();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentParticles = particlesRef.current;

      for (let i = currentParticles.length - 1; i >= 0; i--) {
        const p = currentParticles[i];

        // Physics update
        p.vx *= 0.98; // Air resistance
        p.vy += 0.15; // Gravity
        p.vy *= 0.99; // Air resistance on y

        // Wobble for natural falling motion
        p.wobble += p.wobbleSpeed;
        const wobbleX = Math.sin(p.wobble) * 0.5;
        p.vx += wobbleX * 0.1;

        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.scalePhase += 0.08;
        p.life++;

        // Smooth fade out
        const lifeProgress = p.life / p.maxLife;
        const alpha = lifeProgress < 0.7 ? 1 : 1 - ((lifeProgress - 0.7) / 0.3);

        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // 3D flip effect
        const scaleY = Math.cos(p.scalePhase) * 0.6 + 0.4;
        ctx.scale(1, scaleY);

        // Draw shape
        switch (p.shape) {
          case 'rect':
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            break;
          case 'circle':
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'star':
            drawStar(ctx, p.size);
            break;
        }

        ctx.restore();

        // Remove dead particles
        if (p.life >= p.maxLife || p.y > canvas.height + 50) {
          currentParticles.splice(i, 1);
        }
      }

      ctx.globalAlpha = 1;

      if (currentParticles.length > 0) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

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
  }, [isOpen, onClose, startConfetti]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Confetti Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-60" />

      <div
        className={`bg-hatofes-dark border border-hatofes-gray rounded-2xl p-8 max-w-sm w-full mx-4 text-center relative transform transition-all duration-300 z-50 ${
          showAnimation ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        style={{ boxShadow: '0 0 40px rgba(255, 195, 0, 0.3)' }}
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
        <p className="text-hatofes-gray-light mb-4">{reason}</p>

        {/* Points - DIN font + gradient */}
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
          className="text-sm text-hatofes-gray hover:text-hatofes-white mt-4 transition-colors"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
