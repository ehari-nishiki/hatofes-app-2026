import { useState, useRef } from 'react'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import imageCompression from 'browser-image-compression'
import app from '@/lib/firebase'

const storage = getStorage(app)

interface ImageUploaderProps {
  imageUrl: string
  onChange: (url: string) => void
  label?: string
}

export function ImageUploader({ imageUrl, onChange, label = '画像' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
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

  return (
    <div>
      <label className="block text-sm text-hatofes-gray mb-1">{label}（任意）</label>
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

      {/* エラーメッセージ */}
      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="sr-only"
      />
      {imageUrl && (
        <img src={imageUrl} alt="プレビュー" className="mt-2 max-h-32 rounded-lg object-contain border border-hatofes-gray" />
      )}

      {/* 画像サイズの注意書き */}
      <p className="text-xs text-hatofes-gray mt-1">
        ※ 画像は自動的に圧縮されます（最大1MB）
      </p>
    </div>
  )
}
