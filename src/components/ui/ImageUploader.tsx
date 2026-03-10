import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import heic2any from 'heic2any'
import { functions } from '@/lib/firebase'
import { httpsCallable } from 'firebase/functions'
import { toGoogleDriveDirectUrl, isGoogleDriveUrl } from '@/lib/googleDrive'

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

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      if (error.message.includes('unauthenticated')) {
        return 'ログインが必要です。'
      }
      if (error.message.includes('invalid-argument')) {
        return '対応していないファイル形式です。JPEG, PNG, WebP, GIFのみ対応しています。'
      }
      return error.message
    }
    return '画像のアップロードに失敗しました。'
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ファイルタイプチェック（HEICも許可）
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
                   file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
    if (!file.type.startsWith('image/') && !isHeic) {
      setError('画像ファイルを選択してください')
      return
    }

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      let fileToCompress: File | Blob = file
      let fileName = file.name

      // HEICファイルをJPEGに変換
      if (isHeic) {
        console.log('[ImageUploader] HEIC検出、JPEGに変換中...')
        setProgress(5)
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9,
        })
        fileToCompress = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
        fileName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
        console.log('[ImageUploader] HEIC変換完了')
        setProgress(15)
      }

      // 画像圧縮オプション（より小さく圧縮）
      const options = {
        maxSizeMB: 0.5, // 最大500KBに圧縮
        maxWidthOrHeight: 1280, // 最大幅/高さを1280に
        useWebWorker: true,
        onProgress: (p: number) => setProgress(Math.floor(15 + p * 0.2)) // 15-35%
      }

      console.log('[ImageUploader] 画像圧縮開始:', fileName, `${(fileToCompress.size / 1024 / 1024).toFixed(2)}MB`)

      // 画像を圧縮
      const compressedFile = await imageCompression(fileToCompress as File, options)
      console.log('[ImageUploader] 圧縮完了:', `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)

      setProgress(40)

      // Cloud FunctionからプリサインドアップロードURLを取得
      console.log('[ImageUploader] プリサインドURL取得中...')
      const getUploadUrl = httpsCallable<
        { fileName: string; fileType: string; fileSize: number },
        { uploadUrl: string; publicUrl: string; key: string }
      >(functions, 'getUploadUrl')

      const { data } = await getUploadUrl({
        fileName: fileName,
        fileType: compressedFile.type,
        fileSize: compressedFile.size,
      })

      console.log('[ImageUploader] プリサインドURL取得完了')
      setProgress(50)

      // R2に直接アップロード
      console.log('[ImageUploader] R2へアップロード開始...')
      const uploadResponse = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: compressedFile,
        headers: {
          'Content-Type': compressedFile.type,
        },
      })

      console.log('[ImageUploader] アップロードレスポンス:', uploadResponse.status)

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('[ImageUploader] アップロードエラー:', errorText)
        throw new Error(`アップロードに失敗しました (${uploadResponse.status})`)
      }

      setProgress(90)

      // 公開URLを設定
      console.log('[ImageUploader] アップロード完了:', data.publicUrl)
      onChange(data.publicUrl)

      setProgress(100)

      // 成功メッセージを一時的に表示
      setTimeout(() => setProgress(0), 500)
    } catch (err) {
      console.error('[ImageUploader] エラー:', err)
      setError(getErrorMessage(err))
    } finally {
      setUploading(false)
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
              ※ 大きな画像も自動圧縮されます
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
