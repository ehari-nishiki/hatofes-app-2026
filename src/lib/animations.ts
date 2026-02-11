import { animate, stagger } from 'animejs'

// Re-export for convenience
export { animate, stagger }

// Stagger entrance animation for cards/lists
export function staggerFadeIn(selector: string, delay = 0) {
  return animate(selector, {
    opacity: [0, 1],
    translateY: [30, 0],
    duration: 600,
    delay: stagger(80, { start: delay }),
    ease: 'outQuart',
  })
}

// Pulse animation for emphasis
export function pulseScale(target: HTMLElement | string, scale = 1.05) {
  return animate(target, {
    scale: [1, scale, 1],
    duration: 400,
    ease: 'inOutQuad',
  })
}

// Shake animation for errors or invalid input
export function shake(target: HTMLElement | string) {
  return animate(target, {
    translateX: [-10, 10, -10, 10, 0],
    duration: 400,
    ease: 'inOutQuad',
  })
}

// Counter animation for numbers
export function countUp(
  target: HTMLElement,
  from: number,
  to: number,
  duration = 1000
) {
  const obj = { value: from }
  return animate(obj, {
    value: to,
    duration,
    round: 1,
    ease: 'outExpo',
    onUpdate: () => {
      target.textContent = Math.round(obj.value).toLocaleString()
    },
  })
}

// Card entrance with gradient glow
export function cardEntranceWithGlow(target: HTMLElement | string) {
  return animate(target, {
    opacity: [0, 1],
    scale: [0.95, 1],
    duration: 800,
    ease: 'outQuart',
  })
}

// Floating animation for decorative elements
export function floatAnimation(target: HTMLElement | string) {
  return animate(target, {
    translateY: [-5, 5],
    duration: 2000,
    alternate: true,
    loop: true,
    ease: 'inOutSine',
  })
}

// Particle explosion effect (returns particle data for canvas)
export function createExplosionParticles(
  centerX: number,
  centerY: number,
  count: number,
  colors: string[]
) {
  const particles = []
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const velocity = 3 + Math.random() * 5
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8,
      life: 0,
      maxLife: 60 + Math.random() * 40,
    })
  }
  return particles
}

// Ripple effect from a point
export function rippleEffect(target: HTMLElement, x: number, y: number) {
  const ripple = document.createElement('div')
  ripple.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,195,0,0.4) 0%, transparent 70%);
    transform: translate(-50%, -50%);
    pointer-events: none;
  `
  target.style.position = 'relative'
  target.style.overflow = 'hidden'
  target.appendChild(ripple)

  animate(ripple, {
    width: [0, 300],
    height: [0, 300],
    opacity: [1, 0],
    duration: 600,
    ease: 'outQuart',
    onComplete: () => ripple.remove(),
  })
}

// Screen flash effect
export function screenFlash(color = 'white', duration = 200) {
  const flash = document.createElement('div')
  flash.style.cssText = `
    position: fixed;
    inset: 0;
    background: ${color};
    pointer-events: none;
    z-index: 9999;
  `
  document.body.appendChild(flash)

  animate(flash, {
    opacity: [0.8, 0],
    duration,
    ease: 'outQuad',
    onComplete: () => flash.remove(),
  })
}

// Typewriter effect
export function typewriter(target: HTMLElement, text: string, duration = 1000) {
  target.textContent = ''
  const chars = text.split('')
  const delay = duration / chars.length

  chars.forEach((char, i) => {
    setTimeout(() => {
      target.textContent += char
    }, delay * i)
  })
}

// Unified confetti color palette
export const CONFETTI_COLORS = {
  gold: ['#FFC300', '#FF4E00', '#FFD700', '#ff6347'],
  purple: ['#c084fc', '#a855f7', '#e9d5ff'],
  blue: ['#60a5fa', '#93c5fd', '#3b82f6', '#bfdbfe'],
  green: ['#4ade80', '#86efac', '#22c55e', '#bbf7d0'],
  celebration: ['#FFC300', '#FF4E00', '#FFD700', '#ff6347', '#a855f7', '#60a5fa', '#4ade80'],
}

// Unified gradient styles for DIN font displays
export const GRADIENT_STYLES = {
  gold: {
    background: 'linear-gradient(90deg, #FFC300, #FF4E00)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  purple: {
    background: 'linear-gradient(90deg, #a855f7, #c084fc)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
}
