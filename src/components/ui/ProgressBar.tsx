interface ProgressBarProps {
  progress: number // 0-100
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-hatofes-white mb-1">
        <span>0%</span>
        <span>100%</span>
      </div>
      <div className="h-2 bg-hatofes-gray rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
