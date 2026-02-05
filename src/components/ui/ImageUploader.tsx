import { useState, useRef } from 'react'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import app from '@/lib/firebase'

const storage = getStorage(app)

interface ImageUploaderProps {
  imageUrl: string
  onChange: (url: string) => void
  label?: string
}

export function ImageUploader({ imageUrl, onChange, label = '画像' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const storageRef = ref(storage, `uploads/${Date.now()}-${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      onChange(url)
    } catch (err) {
      console.error('Image upload failed:', err)
    } finally {
      setUploading(false)
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
          {uploading ? 'アップロード中...' : imageUrl ? '画像を変更' : '画像を選択'}
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
    </div>
  )
}
