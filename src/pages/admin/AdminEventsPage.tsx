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
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import type { FestivalEvent, EventCategory } from '@/types/firestore'

type EventWithId = FestivalEvent & { id: string }

const CATEGORY_OPTIONS: { value: EventCategory; label: string }[] = [
  { value: 'stage', label: 'ステージ' },
  { value: 'exhibition', label: '展示' },
  { value: 'food', label: '模擬店' },
  { value: 'game', label: 'ゲーム' },
  { value: 'ceremony', label: '式典' },
  { value: 'other', label: 'その他' },
]

export default function AdminEventsPage() {
  const { currentUser } = useAuth()
  const [events, setEvents] = useState<EventWithId[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    category: 'stage' as EventCategory,
    startTime: '',
    endTime: '',
    isHighlight: false,
  })

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsQuery = query(collection(db, 'events'), orderBy('startTime', 'asc'))
        const snapshot = await getDocs(eventsQuery)
        const eventList: EventWithId[] = []
        snapshot.forEach((doc) => {
          eventList.push({ id: doc.id, ...doc.data() } as EventWithId)
        })
        setEvents(eventList)
      } catch (error) {
        console.error('Error fetching events:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      category: 'stage',
      startTime: '',
      endTime: '',
      isHighlight: false,
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (event: EventWithId) => {
    const startDate = event.startTime.toDate()
    const endDate = event.endTime.toDate()

    setFormData({
      title: event.title,
      description: event.description || '',
      location: event.location,
      category: event.category,
      startTime: startDate.toISOString().slice(0, 16),
      endTime: endDate.toISOString().slice(0, 16),
      isHighlight: event.isHighlight || false,
    })
    setEditingId(event.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    if (!formData.startTime || !formData.endTime) {
      alert('開始時間と終了時間を入力してください')
      return
    }

    const startTime = new Date(formData.startTime)
    const endTime = new Date(formData.endTime)

    if (startTime >= endTime) {
      alert('終了時間は開始時間より後にしてください')
      return
    }

    setSaving(true)
    try {
      const eventData = {
        title: formData.title,
        description: formData.description || null,
        location: formData.location,
        category: formData.category,
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        isHighlight: formData.isHighlight,
        createdAt: editingId ? events.find((e) => e.id === editingId)?.createdAt : serverTimestamp(),
        createdBy: editingId ? events.find((e) => e.id === editingId)?.createdBy : currentUser.uid,
      }

      const eventId = editingId || `event-${Date.now()}`
      await setDoc(doc(db, 'events', eventId), eventData)

      // Update local state
      if (editingId) {
        setEvents((prev) =>
          prev.map((e) => (e.id === editingId ? { ...e, ...eventData, id: editingId } as EventWithId : e))
        )
      } else {
        setEvents((prev) => [...prev, { ...eventData, id: eventId } as EventWithId].sort(
          (a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime()
        ))
      }

      resetForm()
      alert(editingId ? 'イベントを更新しました' : 'イベントを追加しました')
    } catch (error) {
      console.error('Error saving event:', error)
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('このイベントを削除しますか？')) return

    try {
      await deleteDoc(doc(db, 'events', eventId))
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
      alert('イベントを削除しました')
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('削除に失敗しました')
    }
  }

  const formatDateTime = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      {/* Header */}
      <header className="bg-hatofes-dark border-b border-hatofes-gray-lighter px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-hatofes-gray hover:text-hatofes-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-hatofes-white font-display">イベント管理</h1>
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
              {editingId ? 'イベントを編集' : '新しいイベントを追加'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-hatofes-gray mb-2">イベント名 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  placeholder="例: 開会式"
                />
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
                    placeholder="例: 体育館"
                  />
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">カテゴリ *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as EventCategory })}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">開始日時 *</label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-2">終了日時 *</label>
                  <input
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-hatofes-gray mb-2">説明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  placeholder="イベントの説明を入力..."
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isHighlight}
                    onChange={(e) => setFormData({ ...formData, isHighlight: e.target.checked })}
                    className="w-5 h-5 rounded border-hatofes-gray bg-hatofes-dark text-hatofes-accent-yellow"
                  />
                  <span className="text-hatofes-white text-sm">注目イベントとして表示</span>
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

        {/* Event list */}
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-hatofes-gray">イベントが登録されていません</p>
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={`card flex items-center justify-between ${event.isHighlight ? 'ring-1 ring-hatofes-accent-yellow' : ''}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-hatofes-dark text-hatofes-gray">
                      {CATEGORY_OPTIONS.find((c) => c.value === event.category)?.label}
                    </span>
                    {event.isHighlight && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow">
                        注目
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-hatofes-white">{event.title}</h3>
                  <p className="text-sm text-hatofes-gray">
                    {formatDateTime(event.startTime)} - {formatDateTime(event.endTime)}
                  </p>
                  <p className="text-sm text-hatofes-gray">{event.location}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(event)}
                    className="p-2 text-hatofes-gray hover:text-hatofes-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
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
