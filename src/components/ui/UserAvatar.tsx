interface UserAvatarProps {
  name: string
  imageUrl?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-24 h-24 text-4xl',
}

export function UserAvatar({ name, imageUrl, size = 'md', className = '' }: UserAvatarProps) {
  const sizeClass = sizeClasses[size]

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
        loading="lazy"
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-hatofes-accent-yellow to-hatofes-accent-orange flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
    >
      {name.charAt(0)}
    </div>
  )
}
