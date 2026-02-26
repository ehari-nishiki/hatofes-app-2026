interface SkeletonLoaderProps {
  lines?: number
  className?: string
}

export function SkeletonLoader({ lines = 3, className = '' }: SkeletonLoaderProps) {
  const widths = ['60%', '100%', '75%', '90%', '50%']

  return (
    <div className={`skeleton-container ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line"
          style={{ width: widths[i % widths.length] }}
        />
      ))}

      <style>{`
        .skeleton-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .skeleton-line {
          height: 14px;
          border-radius: 4px;
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%);
          background-size: 400% 100%;
          animation: skeleton-loading 1.4s ease infinite;
        }
        @keyframes skeleton-loading {
          0% { background-position: 100% 50%; }
          100% { background-position: 0 50%; }
        }
      `}</style>
    </div>
  )
}

// Card skeleton for list items
export function SkeletonCard({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card flex items-center gap-3 p-3 rounded-xl bg-white/5">
          <div className="skeleton-avatar w-10 h-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-text h-3 w-3/4 rounded" />
            <div className="skeleton-text h-2.5 w-1/2 rounded" />
          </div>
        </div>
      ))}

      <style>{`
        .skeleton-avatar,
        .skeleton-text {
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%);
          background-size: 400% 100%;
          animation: skeleton-loading 1.4s ease infinite;
        }
      `}</style>
    </div>
  )
}
