interface AuroraBackgroundProps {
  children: React.ReactNode
  className?: string
  intensity?: 'subtle' | 'normal' | 'vibrant'
}

export function AuroraBackground({
  children,
  className = '',
  intensity = 'normal'
}: AuroraBackgroundProps) {
  const opacityMap = {
    subtle: 'opacity-30',
    normal: 'opacity-50',
    vibrant: 'opacity-70',
  }

  return (
    <div className={`aurora-container ${className}`}>
      {/* Aurora blobs */}
      <div className={`aurora-blob aurora-blob-1 ${opacityMap[intensity]}`} />
      <div className={`aurora-blob aurora-blob-2 ${opacityMap[intensity]}`} />
      <div className={`aurora-blob aurora-blob-3 ${opacityMap[intensity]}`} />

      {/* Aurora gradient overlay */}
      <div className={`aurora-effect ${opacityMap[intensity]}`} />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

// Simpler version for cards
export function AuroraCard({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`card card-aurora ${className}`}>
      {children}
    </div>
  )
}
