import { useState, useEffect } from 'react'
import { toGoogleDriveDirectUrl, isGoogleDriveUrl } from '@/lib/googleDrive'

interface ImageUrlInputProps {
  value: string
  onChange: (url: string) => void
  placeholder?: string
  className?: string
  showPreview?: boolean
  previewSize?: 'sm' | 'md' | 'lg'
}

export function ImageUrlInput({
  value,
  onChange,
  placeholder = 'https://... または Google Drive リンク',
  className = '',
  showPreview = true,
  previewSize = 'md'
}: ImageUrlInputProps) {
  const [inputValue, setInputValue] = useState(value)
  const [showHelp, setShowHelp] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawUrl = e.target.value
    setInputValue(rawUrl)
    setImageError(false)

    // Convert Google Drive URLs automatically
    const directUrl = toGoogleDriveDirectUrl(rawUrl)
    onChange(directUrl)
  }

  const previewUrl = toGoogleDriveDirectUrl(value)
  const isGDrive = isGoogleDriveUrl(inputValue)

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-32 h-32'
  }

  return (
    <div className={className}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white placeholder-hatofes-gray/50 pr-10"
        />
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-hatofes-gray hover:text-hatofes-accent-yellow transition-colors"
          title="Google Drive の使い方"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {isGDrive && (
        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Google Drive リンクを検出しました
        </p>
      )}

      {showHelp && (
        <div className="mt-2 p-3 bg-hatofes-bg rounded-lg text-xs space-y-2 border border-hatofes-gray/50">
          <p className="text-hatofes-white font-medium">Google Drive から画像を使う方法:</p>
          <ol className="list-decimal list-inside space-y-1 text-hatofes-gray">
            <li>Google Drive で画像を右クリック</li>
            <li>「共有」を選択</li>
            <li>「リンクを知っている全員」に変更</li>
            <li>「リンクをコピー」をクリック</li>
            <li>このフィールドに貼り付け</li>
          </ol>
          <p className="text-hatofes-gray-light mt-2">
            対応形式: JPG, PNG, GIF, WebP
          </p>
        </div>
      )}

      {showPreview && previewUrl && (
        <div className="mt-2">
          {!imageError ? (
            <img
              src={previewUrl}
              alt="プレビュー"
              className={`${sizeClasses[previewSize]} rounded-lg object-cover border border-hatofes-gray`}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className={`${sizeClasses[previewSize]} rounded-lg border border-red-500/50 bg-red-500/10 flex items-center justify-center`}>
              <span className="text-xs text-red-400 text-center px-1">
                画像を読み込めません
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
