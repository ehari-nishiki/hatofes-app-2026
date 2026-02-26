import { ReactNode } from 'react'

// SVG Icons as React components with gradient support
const gradientDef = (id: string) => (
  <defs>
    <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FFC300" />
      <stop offset="100%" stopColor="#FF4E00" />
    </linearGradient>
  </defs>
)

interface IconProps {
  size?: number
  className?: string
  gradient?: boolean
  color?: string
}

export function TetrisIcon({ size = 24, className = '', gradient = true, color }: IconProps) {
  const fill = gradient ? 'url(#tetrisGrad)' : (color || 'currentColor')
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className}>
      {gradient && gradientDef('tetrisGrad')}
      <rect x="23.182" y="10.454" width="8" height="8" rx="1.859" ry="1.859" transform="translate(-2.259 23.454) rotate(-45)" fill={fill} />
      <rect x="16.818" y="16.818" width="8" height="8" rx="1.859" ry="1.859" transform="translate(-8.623 20.818) rotate(-45)" fill={fill} />
      <rect x="23.182" y="23.182" width="8" height="8" rx="1.859" ry="1.859" transform="translate(-11.259 27.182) rotate(-45)" fill={fill} />
      <rect x="16.818" y="29.546" width="8" height="8" rx="1.859" ry="1.859" transform="translate(-17.623 24.546) rotate(-45)" fill={fill} />
    </svg>
  )
}

export function GachaIcon({ size = 24, className = '', gradient = true, color }: IconProps) {
  const fill = gradient ? 'url(#gachaGrad)' : (color || 'currentColor')
  const stroke = gradient ? 'url(#gachaGrad)' : (color || 'currentColor')
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
      {gradient && gradientDef('gachaGrad')}
      <rect x="22.041" y="15.733" width="22.836" height="35.378" rx="3.211" ry="3.211" fill="none" stroke={stroke} strokeWidth="2" />
      <rect x="23.945" y="14.311" width="22.836" height="35.378" rx="3.211" ry="3.211" fill={fill} />
    </svg>
  )
}

export function RadioIcon({ size = 24, className = '', gradient = true, color }: IconProps) {
  const fill = gradient ? 'url(#radioGrad)' : (color || 'currentColor')
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
      {gradient && gradientDef('radioGrad')}
      <path fill={fill} d="M47.033,26.567h-28.585l27.815-14.834c.228-.122.314-.405.193-.633s-.405-.314-.633-.193l-29.483,15.723c-1.45.291-2.542,1.57-2.542,3.105v12.376c0,1.75,1.419,3.169,3.169,3.169h30.067c1.75,0,3.169-1.419,3.169-3.169v-12.376c0-1.75-1.419-3.169-3.169-3.169ZM23.369,42.056c-3.387,0-6.133-2.746-6.133-6.133s2.746-6.133,6.133-6.133,6.133,2.746,6.133,6.133-2.746,6.133-6.133,6.133ZM46.893,40.828h-14.872c-.291,0-.526-.236-.526-.526s.236-.526.526-.526h14.872c.291,0,.526.236.526.526s-.236.526-.526.526ZM46.893,38.652h-14.872c-.291,0-.526-.236-.526-.526s.236-.526.526-.526h14.872c.291,0,.526.236.526.526s-.236.526-.526.526ZM46.893,36.476h-14.872c-.291,0-.526-.236-.526-.526s.236-.526.526-.526h14.872c.291,0,.526.236.526.526s-.236.526-.526.526ZM46.893,34.301h-14.872c-.291,0-.526-.236-.526-.526s.236-.526.526-.526h14.872c.291,0,.526.236.526.526s-.236.526-.526.526ZM46.893,32.125h-14.872c-.291,0-.526-.236-.526-.526s.236-.526.526-.526h14.872c.291,0,.526.236.526.526s-.236.526-.526.526Z"/>
    </svg>
  )
}

export function QAIcon({ size = 24, className = '', gradient = true, color }: IconProps) {
  const fill = gradient ? 'url(#qaGrad)' : (color || 'currentColor')
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
      {gradient && gradientDef('qaGrad')}
      <path fill={fill} d="M21.479,24.357c0-.805.141-1.516.422-2.135.28-.617.655-1.133,1.123-1.545.45-.395.96-.693,1.531-.898.571-.207,1.147-.311,1.729-.311s1.156.104,1.728.311c.571.205,1.091.504,1.56.898.449.412.814.928,1.096,1.545.281.619.421,1.33.421,2.135v10.564c0,.505-.057.967-.173,1.387-.119.431.028.887.376,1.169l.25.202c.493.399.563,1.125.155,1.61h0c-.399.476-1.106.542-1.587.15l-.17-.139c-.36-.294-.864-.337-1.267-.105-.713.41-1.509.615-2.387.615-.581,0-1.157-.104-1.729-.309-.571-.207-1.081-.516-1.531-.928-.468-.393-.843-.889-1.123-1.488-.281-.6-.422-1.32-.422-2.164v-10.564ZM24.345,34.922c0,.693.191,1.203.575,1.531s.839.492,1.363.492c.262,0,.468-.037.618-.113l-.39-.313c-.496-.398-.567-1.126-.159-1.613l.002-.003c.397-.473,1.099-.542,1.581-.155l.286.23v-10.621c0-.691-.192-1.203-.576-1.531-.384-.326-.839-.49-1.362-.49s-.979.164-1.363.49c-.384.328-.575.84-.575,1.531v10.564Z"/>
      <path fill={fill} d="M32.632,38.261l3.961-17.735c.116-.518.576-.887,1.107-.887h.57c.531,0,.991.369,1.107.887l3.961,17.735c.158.709-.381,1.382-1.107,1.382h-.517c-.542,0-1.009-.384-1.113-.916l-.484-2.467c-.104-.532-.571-.916-1.113-.916h-2.038c-.542,0-1.009.384-1.113.916l-.484,2.467c-.104.532-.571.916-1.113.916h-.517c-.726,0-1.265-.673-1.107-1.382ZM38.029,32.646c.713,0,1.249-.65,1.114-1.35l-1.143-5.898h-.056l-1.143,5.898c-.136.7.401,1.35,1.114,1.35h.115Z"/>
    </svg>
  )
}

// Common UI Icons
export function ChevronRightIcon({ size = 16, className = '', color = 'currentColor' }: IconProps & { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke={color} strokeWidth="2">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 16, className = '', color = 'currentColor' }: IconProps & { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke={color} strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArrowRightIcon({ size = 16, className = '', gradient = false, color = 'currentColor' }: IconProps) {
  const stroke = gradient ? 'url(#arrowGrad)' : color
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke={stroke} strokeWidth="2.5">
      {gradient && gradientDef('arrowGrad')}
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BellIcon({ size = 24, className = '', gradient = true, color }: IconProps) {
  const fill = gradient ? 'url(#bellGrad)' : (color || 'currentColor')
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
      {gradient && gradientDef('bellGrad')}
      <path fill={fill} d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
    </svg>
  )
}

export function TaskIcon({ size = 24, className = '', gradient = true, color }: IconProps) {
  const fill = gradient ? 'url(#taskGrad)' : (color || 'currentColor')
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
      {gradient && gradientDef('taskGrad')}
      <path fill={fill} d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  )
}

export function MissionIcon({ size = 24, className = '', gradient = true, color }: IconProps) {
  const fill = gradient ? 'url(#missionGrad)' : (color || 'currentColor')
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
      {gradient && gradientDef('missionGrad')}
      <path fill={fill} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  )
}

// Icon wrapper with background
interface IconBoxProps extends IconProps {
  children: ReactNode
  bgColor?: string
}

export function IconBox({ children, size = 40, className = '', bgColor = 'rgba(255, 195, 0, 0.1)' }: IconBoxProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl ${className}`}
      style={{ width: size, height: size, backgroundColor: bgColor }}
    >
      {children}
    </div>
  )
}
