import { useState, useRef } from 'react'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import imageCompression from 'browser-image-compression'
import app from '@/lib/firebase'
import { toGoogleDriveDirectUrl, isGoogleDriveUrl } from '@/lib/googleDrive'

const storage = getStorage(app)

interface ImageUploaderProps {
  imageUrl: string
  onChange: (url: string) => void
  label?: string
  showGoogleDrive?: boolean // Show Google Drive URL option
}

export function ImageUploader({ imageUrl, onChange, label = '画像', showGoogleDrive = true }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload')
  const [urlInput, setUrlInput] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // 画像圧縮オプション
      const options = {
        maxSizeMB: 1, // 最大1MBに圧縮
        maxWidthOrHeight: 1920, // 最大幅/高さ
        useWebWorker: true, // Web Workerを使用（メインスレッドをブロックしない）
        onProgress: (p: number) => setProgress(p)
      }

      setProgress(10)

      // 画像を圧縮
      const compressedFile = await imageCompression(file, options)

      setProgress(50)

      // Firebase Storageにアップロード
      const storageRef = ref(storage, `uploads/${Date.now()}-${file.name}`)
      await uploadBytes(storageRef, compressedFile)

      setProgress(90)

      // ダウンロードURLを取得
      const url = await getDownloadURL(storageRef)
      onChange(url)

      setProgress(100)
    } catch (err) {
      console.error('Image upload failed:', err)
      setError('画像のアップロードに失敗しました。画像サイズを確認してください。')
    } finally {
      setUploading(false)
      setProgress(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return
    const directUrl = toGoogleDriveDirectUrl(urlInput.trim())
    onChange(directUrl)
    setUrlInput('')
    setError(null)
  }

  return (
    <div>
      <label className="block text-sm text-hatofes-gray mb-1">{label}（任意）</label>

      {/* Mode Toggle */}
      {showGoogleDrive && !imageUrl && (
        <div className="flex gap-1 mb-2">
          <button
            type="button"
            onClick={() => setInputMode('upload')}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              inputMode === 'upload'
                ? 'bg-hatofes-accent-yellow text-black'
                : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-gray hover:text-hatofes-white'
            }`}
          >
            ファイルから
          </button>
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              inputMode === 'url'
                ? 'bg-hatofes-accent-yellow text-black'
                : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-gray hover:text-hatofes-white'
            }`}
          >
            Google Drive
          </button>
        </div>
      )}

      {inputMode === 'upload' || imageUrl ? (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs bg-hatofes-dark border border-hatofes-gray rounded px-3 py-1.5 text-hatofes-white hover:border-hatofes-accent-yellow disabled:opacity-50 transition-colors"
            >
              {uploading ? `アップロード中 ${progress}%` : imageUrl ? '画像を変更' : '画像を選択'}
            </button>
            {imageUrl && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-xs text-red-400 hover:text-red-300"
              >
                削除
              </button>
            )}
          </div>

          {/* プログレスバー */}
          {uploading && (
            <div className="mt-2 w-full bg-hatofes-dark rounded-full h-2 overflow-hidden">
              <div
                className="bg-hatofes-accent-yellow h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="sr-only"
          />

          {!imageUrl && (
            <p className="text-xs text-hatofes-gray mt-1">
              ※ 画像は自動的に圧縮されます（最大1MB）
            </p>
          )}
        </>
      ) : (
        <div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="Google Drive リンクを貼り付け"
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-sm text-hatofes-white placeholder-hatofes-gray/50 pr-8"
              />
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-hatofes-gray hover:text-hatofes-accent-yellow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
              className="text-xs bg-hatofes-accent-yellow text-black px-3 py-2 rounded-lg disabled:opacity-50 hover:bg-hatofes-accent-yellow/80 transition-colors"
            >
              設定
            </button>
          </div>

          {isGoogleDriveUrl(urlInput) && (
            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Google Drive リンクを検出
            </p>
          )}

          {showHelp && (
            <div className="mt-2 p-2 bg-hatofes-bg rounded text-xs space-y-1 border border-hatofes-gray/50">
              <p className="text-hatofes-white font-medium">使い方:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-hatofes-gray">
                <li>Google Drive で画像を右クリック</li>
                <li>「共有」→「リンクを知っている全員」に変更</li>
                <li>「リンクをコピー」して貼り付け</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* エラーメッセージ */}
      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}

      {imageUrl && (
        <img src={imageUrl} alt="プレビュー" className="mt-2 max-h-32 rounded-lg object-contain border border-hatofes-gray" />
      )}
    </div>
  )
}
