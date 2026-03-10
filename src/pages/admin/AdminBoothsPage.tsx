import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { Toast, useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Booth, BoothCategory } from '@/types/firestore'

type BoothWithId = Booth & { id: string }

const CATEGORY_OPTIONS: { value: BoothCategory; label: string }[] = [
  { value: 'food', label: '模擬店' },
  { value: 'game', label: 'ゲーム' },
  { value: 'exhibition', label: '展示' },
  { value: 'stage', label: 'ステージ' },
  { value: 'other', label: 'その他' },
]

export default function AdminBoothsPage() {
  const { currentUser } = useAuth()
  const [booths, setBooths] = useState<BoothWithId[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { toast, showToast, hideToast } = useToast()
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; onConfirm: () => void
  } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    classId: '',
    location: '',
    floor: '',
    description: '',
    category: 'food' as BoothCategory,
    imageUrl: '',
    isActive: true,
  })

  // Fetch booths
  useEffect(() => {
    const fetchBooths = async () => {
      try {
        const boothsQuery = query(collection(db, 'booths'), orderBy('classId', 'asc'))
        const snapshot = await getDocs(boothsQuery)
        const boothList: BoothWithId[] = []
        snapshot.forEach((doc) => {
          boothList.push({ id: doc.id, ...doc.data() } as BoothWithId)
        })
        setBooths(boothList)
      } catch (error) {
        console.error('Error fetching booths:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooths()
  }, [])

  const resetForm = () => {
    setFormData({
      name: '',
      classId: '',
      location: '',
      floor: '',
      description: '',
      category: 'food',
      imageUrl: '',
      isActive: true,
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (booth: BoothWithId) => {
    setFormData({
      name: booth.name,
      classId: booth.classId,
      location: booth.location,
      floor: booth.floor?.toString() || '',
      description: booth.description || '',
      category: booth.category,
      imageUrl: booth.imageUrl || '',
      isActive: booth.isActive,
    })
    setEditingId(booth.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    setSaving(true)
    try {
      const boothData = {
        name: formData.name,
        classId: formData.classId,
        location: formData.location,
        floor: formData.floor ? parseInt(formData.floor) : null,
        description: formData.description || null,
        category: formData.category,
        imageUrl: formData.imageUrl || null,
        isActive: formData.isActive,
        createdAt: editingId ? booths.find((b) => b.id === editingId)?.createdAt : serverTimestamp(),
        createdBy: editingId ? booths.find((b) => b.id === editingId)?.createdBy : currentUser.uid,
      }

      const boothId = editingId || `booth-${Date.now()}`
      await setDoc(doc(db, 'booths', boothId), boothData)

      // Update local state
      if (editingId) {
        setBooths((prev) =>
          prev.map((b) => (b.id === editingId ? { ...b, ...boothData, id: editingId } as BoothWithId : b))
        )
      } else {
        setBooths((prev) => [...prev, { ...boothData, id: boothId } as BoothWithId])
      }

      resetForm()
      showToast(editingId ? 'ブースを更新しました' : 'ブースを追加しました', 'success')
    } catch (error) {
      console.error('Error saving booth:', error)
      showToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (boothId: string) => {
    setConfirmDialog({
      title: 'ブース削除',
      message: 'このブースを削除しますか？',
      onConfirm: async () => {
        setConfirmDialog(null)
        try {
          await deleteDoc(doc(db, 'booths', boothId))
          setBooths((prev) => prev.filter((b) => b.id !== boothId))
          showToast('ブースを削除しました', 'success')
        } catch (error) {
          console.error('Error deleting booth:', error)
          showToast('削除に失敗しました', 'error')
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hatofes-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hatofes-bg">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        variant="danger"
        confirmLabel="削除"
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
      {/* Header */}
      <header className="bg-hatofes-dark border-b border-hatofes-gray-lighter px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-hatofes-gray hover:text-hatofes-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-hatofes-white font-display">ブース管理</h1>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="btn-main px-4 py-2 text-sm"
          >
            + 新規追加
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Form */}
        {showForm && (
          <div className="card mb-8">
            <h2 className="text-lg font-bold text-hatofes-white mb-4">
              {editingId ? 'ブースを編集' : '新しいブースを追加'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">ブース名 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                    placeholder="例: 焼きそば屋"
                  />
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">クラスID *</label>
                  <input
                    type="text"
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    required
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                    placeholder="例: 2-A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">場所 *</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                    placeholder="例: 2年A組教室"
                  />
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">フロア</label>
                  <input
                    type="number"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                    placeholder="例: 2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-hatofes-gray mb-2">カテゴリ *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as BoothCategory })}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-hatofes-gray mb-2">説明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  placeholder="ブースの説明を入力..."
                />
              </div>

              <div>
                <label className="block text-sm text-hatofes-gray mb-2">画像URL</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 rounded border-hatofes-gray bg-hatofes-dark text-hatofes-accent-yellow"
                  />
                  <span className="text-hatofes-white text-sm">公開する</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-main flex-1 py-2 disabled:opacity-50"
                >
                  {saving ? '保存中...' : editingId ? '更新' : '追加'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-sub px-6 py-2"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Booth list */}
        <div className="space-y-3">
          {booths.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-hatofes-gray">ブースが登録されていません</p>
            </div>
          ) : (
            booths.map((booth) => (
              <div
                key={booth.id}
                className={`card flex items-center justify-between ${!booth.isActive ? 'opacity-50' : ''}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-hatofes-dark text-hatofes-gray">
                      {booth.classId}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-hatofes-dark text-hatofes-gray">
                      {CATEGORY_OPTIONS.find((c) => c.value === booth.category)?.label}
                    </span>
                    {!booth.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                        非公開
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-hatofes-white">{booth.name}</h3>
                  <p className="text-sm text-hatofes-gray">
                    {booth.location}
                    {booth.floor && ` (${booth.floor}F)`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(booth)}
                    className="p-2 text-hatofes-gray hover:text-hatofes-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(booth.id)}
                    className="p-2 text-red-400 hover:text-red-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
