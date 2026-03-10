import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, Timestamp, query, orderBy, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { ImageUrlInput } from '@/components/ui/ImageUrlInput'
import type { GachaItem, GachaRarity, GachaItemType } from '@/types/firestore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const functions = getFunctions(app)
const grantGachaTicketsFn = httpsCallable<
  { grade: number; classNum: string; studentNumber: number; tickets: number; details?: string },
  { success: boolean; message: string }
>(functions, 'grantGachaTickets')

const deductGachaTicketsFn = httpsCallable<
  { grade: number; classNum: string; studentNumber: number; tickets: number; details?: string },
  { success: boolean; message: string }
>(functions, 'deductGachaTickets')

const clearGachaTicketsFn = httpsCallable<
  { grade: number; classNum: string; studentNumber: number; details?: string },
  { success: boolean; message: string }
>(functions, 'clearGachaTickets')

const bulkDistributeByClassFn = httpsCallable<
  { grade?: number; classNames?: string[]; tickets?: number; points?: number; details?: string },
  { success: boolean; message: string; successCount: number; totalCount: number; errors?: string[] }
>(functions, 'bulkDistributeByClass')

const RARITY_COLORS: Record<GachaRarity, string> = {
  common: 'bg-gray-500/20 text-gray-400 border-gray-500',
  uncommon: 'bg-green-500/20 text-green-400 border-green-500',
  rare: 'bg-blue-500/20 text-blue-400 border-blue-500',
  epic: 'bg-purple-500/20 text-purple-400 border-purple-500',
  legendary: 'bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow border-hatofes-accent-yellow',
}

// Suggested weights per rarity (higher = more common)
const RARITY_SUGGESTED_WEIGHTS: Record<GachaRarity, number> = {
  common: 5000,      // ~50% (when balanced)
  uncommon: 2500,    // ~25%
  rare: 1000,        // ~10%
  epic: 100,         // ~1%
  legendary: 10,     // ~0.1%
}

const RARITY_LABELS: Record<GachaRarity, string> = {
  common: 'コモン',
  uncommon: 'アンコモン',
  rare: 'レア',
  epic: 'エピック',
  legendary: 'レジェンダリー',
}

interface GachaItemWithId extends GachaItem {
  id: string
}

interface NewGachaItem {
  name: string
  description: string
  type: GachaItemType
  rarity: GachaRarity
  weight: number
  pointsValue: number
  ticketValue: number
  imageUrl: string
}

// Calculate probability from weight
const calculateProbability = (weight: number, totalWeight: number): string => {
  if (totalWeight === 0) return '0%'
  const prob = (weight / totalWeight) * 100
  if (prob >= 1) return `${prob.toFixed(1)}%`
  if (prob >= 0.1) return `${prob.toFixed(2)}%`
  return `${prob.toFixed(3)}%`
}

export default function AdminGachaPage() {
  const { currentUser } = useAuth()
  const [items, setItems] = useState<GachaItemWithId[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newItem, setNewItem] = useState<NewGachaItem>({
    name: '',
    description: '',
    type: 'badge',
    rarity: 'common',
    weight: RARITY_SUGGESTED_WEIGHTS.common,
    pointsValue: 0,
    ticketValue: 0,
    imageUrl: '',
  })

  // Calculate total weight of active items
  const totalActiveWeight = items
    .filter(i => i.isActive)
    .reduce((sum, i) => sum + (i.weight || 0), 0)
  const [editItem, setEditItem] = useState<GachaItemWithId | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Ticket grant state
  const [grantGrade, setGrantGrade] = useState<number | null>(null)
  const [grantClass, setGrantClass] = useState<string | null>(null)
  const [grantStudentNumber, setGrantStudentNumber] = useState<number | null>(null)
  const [grantTickets, setGrantTickets] = useState(1)
  const [grantDetails, setGrantDetails] = useState('')
  const [grantSubmitting, setGrantSubmitting] = useState(false)

  // Ticket deduct state
  const [deductGrade, setDeductGrade] = useState<number | null>(null)
  const [deductClass, setDeductClass] = useState<string | null>(null)
  const [deductStudentNumber, setDeductStudentNumber] = useState<number | null>(null)
  const [deductTickets, setDeductTickets] = useState(1)
  const [deductDetails, setDeductDetails] = useState('')
  const [deductSubmitting, setDeductSubmitting] = useState(false)
  const [deductSearchedUser, setDeductSearchedUser] = useState<{ id: string; username: string; email: string; currentTickets: number } | null>(null)

  const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', 'A', 'B']

  const [searchedUser, setSearchedUser] = useState<{ id: string; username: string; email: string } | null>(null)
  const [searching, setSearching] = useState(false)

  // Bulk distribution state
  const [bulkGrade, setBulkGrade] = useState<number | 'all'>('all')
  const [bulkClasses, setBulkClasses] = useState<string[]>([])
  const [bulkTickets, setBulkTickets] = useState(1)
  const [bulkPoints, setBulkPoints] = useState(0)
  const [bulkDetails, setBulkDetails] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ successCount: number; totalCount: number; errors?: string[] } | null>(null)

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; variant: 'default' | 'danger'; onConfirm: () => void
  } | null>(null)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const q = query(collection(db, 'gachaItems'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      const list: GachaItemWithId[] = []
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() as GachaItem })
      })
      setItems(list)
    } catch (error) {
      console.error('Error fetching gacha items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateItem = async () => {
    if (!newItem.name || !currentUser) return
    setSubmitting(true)
    try {
      const itemId = `gacha-${Date.now()}`
      await setDoc(doc(db, 'gachaItems', itemId), {
        name: newItem.name,
        description: newItem.description,
        type: newItem.type,
        rarity: newItem.rarity,
        weight: newItem.weight,
        ...(newItem.type === 'points' ? { pointsValue: newItem.pointsValue } : {}),
        ...(newItem.type === 'ticket' ? { ticketValue: newItem.ticketValue } : {}),
        ...(newItem.imageUrl ? { imageUrl: newItem.imageUrl } : {}),
        isActive: true,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
      })
      setMessage({ type: 'success', text: 'アイテムを作成しました' })
      // Add to local state instead of refetching
      const createdItem: GachaItemWithId = {
        id: itemId,
        name: newItem.name,
        description: newItem.description,
        type: newItem.type,
        rarity: newItem.rarity,
        weight: newItem.weight,
        pointsValue: newItem.type === 'points' ? newItem.pointsValue : undefined,
        ticketValue: newItem.type === 'ticket' ? newItem.ticketValue : undefined,
        imageUrl: newItem.imageUrl || undefined,
        isActive: true,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
      }
      setItems(prev => [createdItem, ...prev])
      setShowCreate(false)
      setNewItem({ name: '', description: '', type: 'badge', rarity: 'common', weight: RARITY_SUGGESTED_WEIGHTS.common, pointsValue: 0, ticketValue: 0, imageUrl: '' })
    } catch (error) {
      console.error('Error creating item:', error)
      setMessage({ type: 'error', text: 'アイテム作成に失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditItem = async () => {
    if (!editItem || !currentUser) return
    setSubmitting(true)
    try {
      await updateDoc(doc(db, 'gachaItems', editItem.id), {
        name: editItem.name,
        description: editItem.description,
        type: editItem.type,
        rarity: editItem.rarity,
        weight: editItem.weight,
        ...(editItem.type === 'points' ? { pointsValue: editItem.pointsValue || 0 } : { pointsValue: 0 }),
        ...(editItem.type === 'ticket' ? { ticketValue: editItem.ticketValue || 0 } : { ticketValue: 0 }),
        imageUrl: editItem.imageUrl || '',
      })
      setMessage({ type: 'success', text: 'アイテムを更新しました' })
      // Update locally instead of refetching all items
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...editItem } : i))
      setEditItem(null)
    } catch (error) {
      console.error('Error updating item:', error)
      setMessage({ type: 'error', text: 'アイテム更新に失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (item: GachaItemWithId) => {
    try {
      const newIsActive = !item.isActive
      await updateDoc(doc(db, 'gachaItems', item.id), { isActive: newIsActive })
      // Update locally instead of refetching all items
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: newIsActive } : i))
    } catch (error) {
      console.error('Error toggling active:', error)
    }
  }

  const handleDelete = (itemId: string) => {
    setConfirmDialog({
      title: 'アイテム削除',
      message: 'このアイテムを削除しますか？',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null)
        try {
          await deleteDoc(doc(db, 'gachaItems', itemId))
          // Remove from local state instead of refetching
          setItems(prev => prev.filter(i => i.id !== itemId))
        } catch (error) {
          console.error('Error deleting item:', error)
        }
      },
    })
  }

  const handleSearchUser = async () => {
    if (grantGrade == null || !grantClass || grantStudentNumber == null) return
    setSearching(true)
    setSearchedUser(null)
    try {
      const q = query(
        collection(db, 'users'),
        where('grade', '==', grantGrade),
        where('class', '==', grantClass),
        where('studentNumber', '==', grantStudentNumber)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        const d = snap.docs[0]
        setSearchedUser({ id: d.id, username: d.data().username, email: d.data().email })
      } else {
        setMessage({ type: 'error', text: '該当のユーザーが見つかりません' })
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleGrantTickets = async () => {
    if (grantGrade == null || !grantClass || grantStudentNumber == null || grantTickets < 1 || grantSubmitting) return
    setGrantSubmitting(true)
    try {
      const result = await grantGachaTicketsFn({
        grade: grantGrade,
        classNum: grantClass,
        studentNumber: grantStudentNumber,
        tickets: grantTickets,
        details: grantDetails || undefined,
      })
      setMessage({ type: 'success', text: result.data.message })
      setGrantGrade(null)
      setGrantClass(null)
      setGrantStudentNumber(null)
      setGrantTickets(1)
      setGrantDetails('')
      setSearchedUser(null)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'チケット付与に失敗しました'
      setMessage({ type: 'error', text: msg })
    } finally {
      setGrantSubmitting(false)
    }
  }

  const handleSearchDeductUser = async () => {
    if (deductGrade == null || !deductClass || deductStudentNumber == null) return
    setSearching(true)
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('grade', '==', deductGrade),
        where('class', '==', deductClass),
        where('studentNumber', '==', deductStudentNumber)
      )
      const snapshot = await getDocs(usersQuery)
      if (!snapshot.empty) {
        const user = snapshot.docs[0]
        const userData = user.data()
        setDeductSearchedUser({
          id: user.id,
          username: userData.username,
          email: userData.email,
          currentTickets: userData.gachaTickets || 0,
        })
        setMessage(null)
      } else {
        setMessage({ type: 'error', text: '該当のユーザーが見つかりません' })
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleDeductTickets = async () => {
    if (deductGrade == null || !deductClass || deductStudentNumber == null || deductTickets < 1 || deductSubmitting) return
    setDeductSubmitting(true)
    try {
      const result = await deductGachaTicketsFn({
        grade: deductGrade,
        classNum: deductClass,
        studentNumber: deductStudentNumber,
        tickets: deductTickets,
        details: deductDetails || undefined,
      })
      setMessage({ type: 'success', text: result.data.message })
      setDeductGrade(null)
      setDeductClass(null)
      setDeductStudentNumber(null)
      setDeductTickets(1)
      setDeductDetails('')
      setDeductSearchedUser(null)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'チケット剥奪に失敗しました'
      setMessage({ type: 'error', text: msg })
    } finally {
      setDeductSubmitting(false)
    }
  }

  const handleClearTickets = () => {
    if (deductGrade == null || !deductClass || deductStudentNumber == null || deductSubmitting) return
    setConfirmDialog({
      title: 'チケットクリア',
      message: 'このユーザーの全チケットをクリアしますか？',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null)
        setDeductSubmitting(true)
        try {
          const result = await clearGachaTicketsFn({
            grade: deductGrade,
            classNum: deductClass,
            studentNumber: deductStudentNumber,
            details: deductDetails || undefined,
          })
          setMessage({ type: 'success', text: result.data.message })
          setDeductGrade(null)
          setDeductClass(null)
          setDeductStudentNumber(null)
          setDeductTickets(1)
          setDeductDetails('')
          setDeductSearchedUser(null)
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'チケットクリアに失敗しました'
          setMessage({ type: 'error', text: msg })
        } finally {
          setDeductSubmitting(false)
        }
      },
    })
  }

  const handleBulkDistribute = () => {
    if (bulkTickets <= 0 && bulkPoints <= 0) {
      setMessage({ type: 'error', text: 'チケットまたはポイントを指定してください' })
      return
    }
    if (bulkSubmitting) return

    const targetDesc = bulkGrade === 'all' ? '全学年' : `${bulkGrade}年生`
    const classDesc = bulkClasses.length === 0 ? '全クラス' : `${bulkClasses.join(', ')}組`
    const itemDesc = []
    if (bulkTickets > 0) itemDesc.push(`${bulkTickets}チケット`)
    if (bulkPoints > 0) itemDesc.push(`${bulkPoints}pt`)

    setConfirmDialog({
      title: '一括配布',
      message: `${targetDesc}${classDesc}に${itemDesc.join('と')}を配布しますか？`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null)
        setBulkSubmitting(true)
        setBulkResult(null)
        try {
          const result = await bulkDistributeByClassFn({
            grade: bulkGrade === 'all' ? undefined : bulkGrade,
            classNames: bulkClasses.length > 0 ? bulkClasses : undefined,
            tickets: bulkTickets > 0 ? bulkTickets : undefined,
            points: bulkPoints > 0 ? bulkPoints : undefined,
            details: bulkDetails || undefined,
          })
          setMessage({ type: 'success', text: result.data.message })
          setBulkResult({
            successCount: result.data.successCount,
            totalCount: result.data.totalCount,
            errors: result.data.errors,
          })
          setBulkTickets(1)
          setBulkPoints(0)
          setBulkDetails('')
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '一括配布に失敗しました'
          setMessage({ type: 'error', text: msg })
        } finally {
          setBulkSubmitting(false)
        }
      },
    })
  }

  const toggleBulkClass = (className: string) => {
    setBulkClasses(prev =>
      prev.includes(className)
        ? prev.filter(c => c !== className)
        : [...prev, className]
    )
  }

  return (
    <div className="min-h-screen bg-hatofes-bg">
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        variant={confirmDialog?.variant || 'default'}
        confirmLabel="実行"
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
      {/* Header */}
      <header className="bg-hatofes-dark border-b border-hatofes-gray-lighter px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-hatofes-gray hover:text-hatofes-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="font-display text-xl font-bold text-hatofes-white">ガチャ管理</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-main text-sm px-4 py-2">
            アイテム追加
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {message && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Create Item Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-hatofes-dark rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-hatofes-gray">
              <h2 className="text-lg font-bold text-hatofes-white mb-4">アイテムを作成</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">アイテム名</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">説明</label>
                  <textarea
                    value={newItem.description}
                    onChange={e => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    rows={2}
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-hatofes-gray mb-1">タイプ</label>
                    <select
                      value={newItem.type}
                      onChange={e => setNewItem(prev => ({ ...prev, type: e.target.value as GachaItemType }))}
                      className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    >
                      <option value="badge">バッジ</option>
                      <option value="coupon">クーポン</option>
                      <option value="points">ポイント</option>
                      <option value="ticket">チケット</option>
                      <option value="custom">カスタム</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-hatofes-gray mb-1">レアリティ</label>
                    <select
                      value={newItem.rarity}
                      onChange={e => {
                        const rarity = e.target.value as GachaRarity
                        setNewItem(prev => ({ ...prev, rarity, weight: RARITY_SUGGESTED_WEIGHTS[rarity] }))
                      }}
                      className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    >
                      <option value="common">コモン</option>
                      <option value="uncommon">アンコモン</option>
                      <option value="rare">レア</option>
                      <option value="epic">エピック</option>
                      <option value="legendary">レジェンダリー</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">
                    排出確率
                    <span className="text-hatofes-accent-yellow ml-2">
                      {calculateProbability(newItem.weight, totalActiveWeight + newItem.weight)}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(Object.keys(RARITY_SUGGESTED_WEIGHTS) as GachaRarity[]).map(rarity => (
                      <button
                        key={rarity}
                        type="button"
                        onClick={() => setNewItem(prev => ({ ...prev, weight: RARITY_SUGGESTED_WEIGHTS[rarity] }))}
                        className={`text-xs px-2 py-1 rounded border transition-all ${
                          newItem.weight === RARITY_SUGGESTED_WEIGHTS[rarity]
                            ? RARITY_COLORS[rarity]
                            : 'border-hatofes-gray text-hatofes-gray hover:border-hatofes-white hover:text-hatofes-white'
                        }`}
                      >
                        {RARITY_LABELS[rarity]} ({RARITY_SUGGESTED_WEIGHTS[rarity]})
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={newItem.weight}
                      onChange={e => setNewItem(prev => ({ ...prev, weight: parseInt(e.target.value) || 1 }))}
                      className="w-32 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                      min={1}
                    />
                    <span className="text-xs text-hatofes-gray">
                      (高い = 出やすい)
                    </span>
                  </div>
                </div>
                {newItem.type === 'points' && (
                  <div>
                    <label className="block text-sm text-hatofes-gray mb-1">付与ポイント数</label>
                    <input
                      type="number"
                      value={newItem.pointsValue}
                      onChange={e => setNewItem(prev => ({ ...prev, pointsValue: parseInt(e.target.value) || 0 }))}
                      className="w-32 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    />
                  </div>
                )}
                {newItem.type === 'ticket' && (
                  <div>
                    <label className="block text-sm text-hatofes-gray mb-1">付与チケット枚数</label>
                    <input
                      type="number"
                      value={newItem.ticketValue}
                      onChange={e => setNewItem(prev => ({ ...prev, ticketValue: parseInt(e.target.value) || 0 }))}
                      className="w-32 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">画像（任意・Google Drive対応）</label>
                  <ImageUrlInput
                    value={newItem.imageUrl}
                    onChange={url => setNewItem(prev => ({ ...prev, imageUrl: url }))}
                    showPreview={true}
                    previewSize="md"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowCreate(false)} className="btn-sub flex-1 py-2">キャンセル</button>
                <button onClick={handleCreateItem} disabled={submitting || !newItem.name} className="btn-main flex-1 py-2 disabled:opacity-50">
                  {submitting ? <Spinner size="sm" className="mx-auto" /> : '作成'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {editItem && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-hatofes-dark rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-hatofes-gray">
              <h2 className="text-lg font-bold text-hatofes-white mb-4">アイテムを編集</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">アイテム名</label>
                  <input
                    type="text"
                    value={editItem.name}
                    onChange={e => setEditItem(prev => prev && { ...prev, name: e.target.value })}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">説明</label>
                  <textarea
                    value={editItem.description}
                    onChange={e => setEditItem(prev => prev && { ...prev, description: e.target.value })}
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    rows={2}
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-hatofes-gray mb-1">タイプ</label>
                    <select
                      value={editItem.type}
                      onChange={e => setEditItem(prev => prev && { ...prev, type: e.target.value as GachaItemType })}
                      className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    >
                      <option value="badge">バッジ</option>
                      <option value="coupon">クーポン</option>
                      <option value="points">ポイント</option>
                      <option value="ticket">チケット</option>
                      <option value="custom">カスタム</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-hatofes-gray mb-1">レアリティ</label>
                    <select
                      value={editItem.rarity}
                      onChange={e => {
                        const rarity = e.target.value as GachaRarity
                        setEditItem(prev => prev && { ...prev, rarity, weight: RARITY_SUGGESTED_WEIGHTS[rarity] })
                      }}
                      className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    >
                      <option value="common">コモン</option>
                      <option value="uncommon">アンコモン</option>
                      <option value="rare">レア</option>
                      <option value="epic">エピック</option>
                      <option value="legendary">レジェンダリー</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">
                    排出確率
                    <span className="text-hatofes-accent-yellow ml-2">
                      {calculateProbability(editItem.weight, totalActiveWeight - (editItem.isActive ? (items.find(i => i.id === editItem.id)?.weight || 0) : 0) + editItem.weight)}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(Object.keys(RARITY_SUGGESTED_WEIGHTS) as GachaRarity[]).map(rarity => (
                      <button
                        key={rarity}
                        type="button"
                        onClick={() => setEditItem(prev => prev && { ...prev, weight: RARITY_SUGGESTED_WEIGHTS[rarity] })}
                        className={`text-xs px-2 py-1 rounded border transition-all ${
                          editItem.weight === RARITY_SUGGESTED_WEIGHTS[rarity]
                            ? RARITY_COLORS[rarity]
                            : 'border-hatofes-gray text-hatofes-gray hover:border-hatofes-white hover:text-hatofes-white'
                        }`}
                      >
                        {RARITY_LABELS[rarity]} ({RARITY_SUGGESTED_WEIGHTS[rarity]})
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editItem.weight}
                      onChange={e => setEditItem(prev => prev && { ...prev, weight: parseInt(e.target.value) || 1 })}
                      className="w-32 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                      min={1}
                    />
                    <span className="text-xs text-hatofes-gray">
                      (高い = 出やすい)
                    </span>
                  </div>
                </div>
                {editItem.type === 'points' && (
                  <div>
                    <label className="block text-sm text-hatofes-gray mb-1">付与ポイント数</label>
                    <input
                      type="number"
                      value={editItem.pointsValue || 0}
                      onChange={e => setEditItem(prev => prev && { ...prev, pointsValue: parseInt(e.target.value) || 0 })}
                      className="w-32 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    />
                  </div>
                )}
                {editItem.type === 'ticket' && (
                  <div>
                    <label className="block text-sm text-hatofes-gray mb-1">付与チケット枚数</label>
                    <input
                      type="number"
                      value={editItem.ticketValue || 0}
                      onChange={e => setEditItem(prev => prev && { ...prev, ticketValue: parseInt(e.target.value) || 0 })}
                      className="w-32 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">画像（任意・Google Drive対応）</label>
                  <ImageUrlInput
                    value={editItem.imageUrl || ''}
                    onChange={url => setEditItem(prev => prev && { ...prev, imageUrl: url })}
                    showPreview={true}
                    previewSize="md"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setEditItem(null)} className="btn-sub flex-1 py-2">キャンセル</button>
                <button onClick={handleEditItem} disabled={submitting || !editItem.name} className="btn-main flex-1 py-2 disabled:opacity-50">
                  {submitting ? <Spinner size="sm" className="mx-auto" /> : '更新'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Item List */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-hatofes-white">アイテム一覧</h2>
            {!loading && items.length > 0 && (
              <div className="text-xs text-hatofes-gray">
                有効アイテム: <span className="text-hatofes-white">{items.filter(i => i.isActive).length}</span>件
                <span className="mx-2">|</span>
                総重み: <span className="text-hatofes-accent-yellow">{totalActiveWeight.toLocaleString()}</span>
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner size="lg" /></div>
          ) : items.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">アイテムがありません</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-hatofes-dark p-4 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-hatofes-white font-medium">{item.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded border ${RARITY_COLORS[item.rarity]}`}>
                          {RARITY_LABELS[item.rarity]}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-hatofes-bg text-hatofes-gray">
                          {item.type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${item.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {item.isActive ? '公開中' : '非公開'}
                        </span>
                      </div>
                      <p className="text-sm text-hatofes-gray mt-1">{item.description}</p>
                      <p className="text-xs text-hatofes-gray mt-1">
                        確率: <span className={item.isActive ? 'text-hatofes-accent-yellow' : ''}>
                          {item.isActive ? calculateProbability(item.weight, totalActiveWeight) : '(非公開)'}
                        </span>
                        <span className="ml-2 text-hatofes-gray/60">(重み: {item.weight})</span>
                        {item.type === 'points' && item.pointsValue ? ` / ポイント: ${item.pointsValue}` : ''}
                        {item.type === 'ticket' && item.ticketValue ? ` / チケット: ${item.ticketValue}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditItem(item)}
                        className="text-xs text-hatofes-accent-yellow hover:text-hatofes-accent-yellow/80"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleToggleActive(item)}
                        className="text-xs text-hatofes-gray hover:text-hatofes-white"
                      >
                        {item.isActive ? '非公開にする' : '公開する'}
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticket Grant Section */}
        <div className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">チケット配布</h2>
          <div className="space-y-4">
            {/* 学年 */}
            <div>
              <label className="block text-sm text-hatofes-gray mb-2">学年</label>
              <div className="flex gap-2">
                {[1, 2, 3].map(g => (
                  <button
                    key={g}
                    onClick={() => { setGrantGrade(g); setSearchedUser(null) }}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                      grantGrade === g
                        ? 'bg-hatofes-accent-yellow text-black'
                        : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow'
                    }`}
                  >
                    {g}年
                  </button>
                ))}
              </div>
            </div>

            {/* クラス */}
            <div>
              <label className="block text-sm text-hatofes-gray mb-2">クラス</label>
              <div className="flex gap-1.5 flex-wrap">
                {CLASS_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => { setGrantClass(c); setSearchedUser(null) }}
                    className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                      grantClass === c
                        ? 'bg-hatofes-accent-yellow text-black'
                        : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 名簿番号 */}
            <div>
              <label className="block text-sm text-hatofes-gray mb-1">名簿番号</label>
              <input
                type="number"
                value={grantStudentNumber ?? ''}
                onChange={e => { setGrantStudentNumber(e.target.value === '' ? null : parseInt(e.target.value)); setSearchedUser(null) }}
                min={1}
                max={40}
                placeholder="番号"
                className="w-24 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white placeholder-hatofes-gray"
              />
            </div>

            {/* 選択プレビュー */}
            {(grantGrade != null || grantClass || grantStudentNumber != null) && (
              <div className="bg-hatofes-dark rounded-lg px-3 py-2 text-sm">
                <span className="text-hatofes-gray">対象: </span>
                <span className="text-hatofes-white font-medium">
                  {grantGrade != null ? `${grantGrade}年` : '?'}
                  {grantClass || '?'}
                  クラス・
                  {grantStudentNumber != null ? `${grantStudentNumber}番` : '?'}
                </span>
              </div>
            )}

            {/* 検索 */}
            {grantGrade != null && grantClass && grantStudentNumber != null && !searchedUser && (
              <button
                onClick={handleSearchUser}
                disabled={searching}
                className="btn-sub w-full py-2 disabled:opacity-50"
              >
                {searching ? '検索中...' : 'ユーザーを検索'}
              </button>
            )}

            {/* 検索結果 */}
            {searchedUser && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-sm">
                <span className="text-hatofes-gray">見つかった: </span>
                <span className="text-green-400 font-bold">{searchedUser.username}</span>
                <span className="text-hatofes-gray ml-2 text-xs">{searchedUser.email}</span>
              </div>
            )}

            <div className="flex gap-3">
              <div>
                <label className="block text-sm text-hatofes-gray mb-1">枚数</label>
                <input
                  type="number"
                  value={grantTickets}
                  onChange={e => setGrantTickets(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-24 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-hatofes-gray mb-1">備考</label>
                <input
                  type="text"
                  value={grantDetails}
                  onChange={e => setGrantDetails(e.target.value)}
                  placeholder="任意"
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white placeholder-hatofes-gray"
                />
              </div>
            </div>
            <button
              onClick={handleGrantTickets}
              disabled={!searchedUser || grantTickets < 1 || grantSubmitting}
              className="btn-main w-full py-2 disabled:opacity-50"
            >
              {grantSubmitting ? <Spinner size="sm" className="mx-auto" /> : 'チケットを配布'}
            </button>
          </div>
        </div>

        {/* Ticket Deduct Section */}
        <div className="card border-2 border-red-500/30">
          <h2 className="text-lg font-bold text-red-400 mb-4">チケット剥奪 ⚠️</h2>
          <div className="space-y-4">
            {/* 学年 */}
            <div>
              <label className="block text-sm text-hatofes-gray mb-2">学年</label>
              <div className="flex gap-2">
                {[1, 2, 3].map(g => (
                  <button
                    key={g}
                    onClick={() => { setDeductGrade(g); setDeductSearchedUser(null) }}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                      deductGrade === g
                        ? 'bg-red-500 text-white'
                        : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-red-500'
                    }`}
                  >
                    {g}年
                  </button>
                ))}
              </div>
            </div>

            {/* クラス */}
            <div>
              <label className="block text-sm text-hatofes-gray mb-2">クラス</label>
              <div className="flex gap-1.5 flex-wrap">
                {CLASS_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => { setDeductClass(c); setDeductSearchedUser(null) }}
                    className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                      deductClass === c
                        ? 'bg-red-500 text-white'
                        : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-red-500'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 名簿番号 */}
            <div>
              <label className="block text-sm text-hatofes-gray mb-1">名簿番号</label>
              <input
                type="number"
                value={deductStudentNumber ?? ''}
                onChange={e => { setDeductStudentNumber(e.target.value === '' ? null : parseInt(e.target.value)); setDeductSearchedUser(null) }}
                min={1}
                max={40}
                placeholder="番号"
                className="w-24 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white placeholder-hatofes-gray"
              />
            </div>

            {/* 選択プレビュー */}
            {(deductGrade != null || deductClass || deductStudentNumber != null) && (
              <div className="bg-hatofes-dark rounded-lg px-3 py-2 text-sm">
                <span className="text-hatofes-gray">対象: </span>
                <span className="text-hatofes-white font-medium">
                  {deductGrade != null ? `${deductGrade}年` : '?'}
                  {deductClass || '?'}
                  クラス・
                  {deductStudentNumber != null ? `${deductStudentNumber}番` : '?'}
                </span>
              </div>
            )}

            {/* 検索 */}
            {deductGrade != null && deductClass && deductStudentNumber != null && !deductSearchedUser && (
              <button
                onClick={handleSearchDeductUser}
                disabled={searching}
                className="btn-sub w-full py-2 disabled:opacity-50"
              >
                {searching ? '検索中...' : 'ユーザーを検索'}
              </button>
            )}

            {/* 検索結果 */}
            {deductSearchedUser && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm space-y-1">
                <div>
                  <span className="text-hatofes-gray">ユーザー: </span>
                  <span className="text-red-400 font-bold">{deductSearchedUser.username}</span>
                  <span className="text-hatofes-gray ml-2 text-xs">{deductSearchedUser.email}</span>
                </div>
                <div>
                  <span className="text-hatofes-gray">現在のチケット数: </span>
                  <span className="text-hatofes-white font-bold">{deductSearchedUser.currentTickets}枚</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <div>
                <label className="block text-sm text-hatofes-gray mb-1">剥奪枚数</label>
                <input
                  type="number"
                  value={deductTickets}
                  onChange={e => setDeductTickets(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-24 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-hatofes-gray mb-1">理由</label>
                <input
                  type="text"
                  value={deductDetails}
                  onChange={e => setDeductDetails(e.target.value)}
                  placeholder="必須"
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white placeholder-hatofes-gray"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDeductTickets}
                disabled={!deductSearchedUser || deductTickets < 1 || deductSubmitting || !deductDetails}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition-colors"
              >
                {deductSubmitting ? <Spinner size="sm" className="mx-auto" /> : `${deductTickets}枚 剥奪`}
              </button>
              <button
                onClick={handleClearTickets}
                disabled={!deductSearchedUser || deductSubmitting || !deductDetails}
                className="flex-1 bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition-colors"
              >
                {deductSubmitting ? <Spinner size="sm" className="mx-auto" /> : '全クリア'}
              </button>
            </div>
            <p className="text-xs text-red-400">⚠️ この操作は取り消せません。慎重に実行してください。</p>
          </div>
        </div>

        {/* Bulk Distribution Section */}
        <div className="card border-2 border-hatofes-accent-yellow/30">
          <h2 className="text-lg font-bold text-hatofes-accent-yellow mb-4">📦 一括配布（学年・クラス）</h2>
          <div className="space-y-4">
            {/* 学年選択 */}
            <div>
              <label className="block text-sm text-hatofes-gray mb-2">対象学年</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setBulkGrade('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    bulkGrade === 'all'
                      ? 'bg-hatofes-accent-yellow text-black'
                      : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow'
                  }`}
                >
                  全学年
                </button>
                {[1, 2, 3].map(g => (
                  <button
                    key={g}
                    onClick={() => setBulkGrade(g)}
                    className={`w-12 h-10 rounded-lg text-sm font-bold transition-all ${
                      bulkGrade === g
                        ? 'bg-hatofes-accent-yellow text-black'
                        : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow'
                    }`}
                  >
                    {g}年
                  </button>
                ))}
              </div>
            </div>

            {/* クラス選択 */}
            <div>
              <label className="block text-sm text-hatofes-gray mb-2">
                対象クラス
                <span className="text-xs ml-2 text-hatofes-gray/60">（未選択で全クラス）</span>
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {CLASS_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleBulkClass(c)}
                    className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                      bulkClasses.includes(c)
                        ? 'bg-hatofes-accent-yellow text-black'
                        : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                {bulkClasses.length > 0 && (
                  <button
                    onClick={() => setBulkClasses([])}
                    className="px-3 py-1 rounded-lg text-xs text-hatofes-gray hover:text-hatofes-white border border-hatofes-gray hover:border-hatofes-white transition-colors"
                  >
                    クリア
                  </button>
                )}
              </div>
            </div>

            {/* 対象プレビュー */}
            <div className="bg-hatofes-dark rounded-lg px-3 py-2 text-sm">
              <span className="text-hatofes-gray">対象: </span>
              <span className="text-hatofes-accent-yellow font-bold">
                {bulkGrade === 'all' ? '全学年' : `${bulkGrade}年生`}
                {' / '}
                {bulkClasses.length === 0 ? '全クラス' : `${bulkClasses.join(', ')}組`}
              </span>
            </div>

            {/* チケット・ポイント入力 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-hatofes-gray mb-1">🎫 チケット</label>
                <input
                  type="number"
                  value={bulkTickets}
                  onChange={e => setBulkTickets(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                />
              </div>
              <div>
                <label className="block text-sm text-hatofes-gray mb-1">💰 ポイント</label>
                <input
                  type="number"
                  value={bulkPoints}
                  onChange={e => setBulkPoints(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                />
              </div>
            </div>

            {/* 備考 */}
            <div>
              <label className="block text-sm text-hatofes-gray mb-1">備考（任意）</label>
              <input
                type="text"
                value={bulkDetails}
                onChange={e => setBulkDetails(e.target.value)}
                placeholder="例: 文化祭参加ボーナス"
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white placeholder-hatofes-gray"
              />
            </div>

            {/* 結果表示 */}
            {bulkResult && (
              <div className="bg-hatofes-dark p-4 rounded-lg">
                <p className="text-hatofes-white font-medium mb-2">
                  配布完了: {bulkResult.successCount} / {bulkResult.totalCount}人
                </p>
                {bulkResult.errors && bulkResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-red-400 text-sm font-medium mb-1">エラー:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {bulkResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-hatofes-gray">{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 配布ボタン */}
            <button
              onClick={handleBulkDistribute}
              disabled={bulkSubmitting || (bulkTickets <= 0 && bulkPoints <= 0)}
              className="btn-main w-full py-3 text-lg disabled:opacity-50"
            >
              {bulkSubmitting ? <Spinner size="sm" className="mx-auto" /> : '🚀 一括配布を実行'}
            </button>

            <p className="text-xs text-hatofes-gray text-center">
              この操作は対象の全ユーザーに即座にチケット・ポイントを付与します
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
