import { calculateLevel, LEVEL_TITLES, LEVEL_COLORS } from '@/lib/levelSystem'

interface LevelBadgeProps {
  points: number
  size?: 'sm' | 'md' | 'lg'
  showTitle?: boolean
}

export function LevelBadge({ points, size = 'md', showTitle = false }: LevelBadgeProps) {
  const level = calculateLevel(points)
  const colors = LEVEL_COLORS[level] || LEVEL_COLORS[1]
  const title = LEVEL_TITLES[level] || 'ROOKIE'

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${sizeClasses[size]}`}
      style={{
        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
        color: 'white',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }}
    >
      <span>Lv.{level}</span>
      {showTitle && <span className="font-normal opacity-90">{title}</span>}
    </span>
  )
}
