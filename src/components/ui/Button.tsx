import { ReactNode, ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  children: ReactNode
}

const variantClasses = {
  primary: 'bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange text-black font-bold hover:opacity-90',
  secondary: 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow hover:text-hatofes-accent-yellow',
  ghost: 'bg-transparent text-hatofes-gray hover:text-hatofes-white',
  outline: 'bg-transparent border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

// Link styled as button
interface LinkButtonProps {
  to: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  children: ReactNode
  className?: string
}

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
}: LinkButtonProps) {
  return (
    <Link
      to={to}
      className={`
        inline-flex items-center justify-center
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </Link>
  )
}

// View More button with chevrons
interface ViewMoreButtonProps {
  to: string
  className?: string
}

export function ViewMoreButton({ to, className = '' }: ViewMoreButtonProps) {
  return (
    <Link
      to={to}
      className={`
        flex items-center justify-center gap-2 py-3 mt-2
        text-hatofes-gray hover:text-hatofes-white
        transition-colors
        ${className}
      `}
    >
      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-sm font-medium">View More</span>
      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

// Point badge
interface PointBadgeProps {
  points: number
  completed?: boolean
  size?: 'sm' | 'md'
}

export function PointBadge({ points, completed = false, size = 'md' }: PointBadgeProps) {
  if (completed) {
    return (
      <span className={`
        text-hatofes-gray
        ${size === 'sm' ? 'text-xs' : 'text-sm'}
      `}>
        ✓ {points}pt
      </span>
    )
  }

  return (
    <span className={`
      bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange
      text-black font-bold rounded-full
      ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
    `}>
      {points}pt
    </span>
  )
}

// Notification count badge
interface CountBadgeProps {
  count: number
  color?: 'orange' | 'blue' | 'red'
}

export function CountBadge({ count, color = 'orange' }: CountBadgeProps) {
  const colorClasses = {
    orange: 'bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
  }

  return (
    <span className={`
      ${colorClasses[color]}
      text-black text-xs font-bold
      min-w-[20px] h-5 px-1.5
      rounded-full
      flex items-center justify-center
    `}>
      {count}
    </span>
  )
}
