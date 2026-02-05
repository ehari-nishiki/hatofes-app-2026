import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, Timestamp, query, orderBy, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '@/lib/firebase'
import app from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import type { GachaItem, GachaRarity, GachaItemType } from '@/types/firestore'

const functions = getFunctions(app)
const grantGachaTicketsFn = httpsCallable<
  { grade: number; classNum: string; studentNumber: number; tickets: number; details?: string },
  { success: boolean; message: string }
>(functions, 'grantGachaTickets')

const RARITY_COLORS: Record<GachaRarity, string> = {
  common: 'bg-gray-500/20 text-gray-400 border-gray-500',
  uncommon: 'bg-green-500/20 text-green-400 border-green-500',
  rare: 'bg-blue-500/20 text-blue-400 border-blue-500',
  epic: 'bg-purple-500/20 text-purple-400 border-purple-500',
  legendary: 'bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow border-hatofes-accent-yellow',
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
    weight: 1000,
    pointsValue: 0,
    ticketValue: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Ticket grant state
  const [grantGrade, setGrantGrade] = useState<number | null>(null)
  const [grantClass, setGrantClass] = useState<string | null>(null)
  const [grantStudentNumber, setGrantStudentNumber] = useState<number | null>(null)
  const [grantTickets, setGrantTickets] = useState(1)
  const [grantDetails, setGrantDetails] = useState('')
  const [grantSubmitting, setGrantSubmitting] = useState(false)

  const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', 'A', 'B']

  const [searchedUser, setSearchedUser] = useState<{ id: string; username: string; email: string } | null>(null)
  const [searching, setSearching] = useState(false)

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
        isActive: true,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
      })
      setMessage({ type: 'success', text: 'アイテムを作成しました' })
      setShowCreate(false)
      setNewItem({ name: '', description: '', type: 'badge', rarity: 'common', weight: 1000, pointsValue: 0, ticketValue: 0 })
      fetchItems()
    } catch (error) {
      console.error('Error creating item:', error)
      setMessage({ type: 'error', text: 'アイテム作成に失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (item: GachaItemWithId) => {
    try {
      await updateDoc(doc(db, 'gachaItems', item.id), { isActive: !item.isActive })
      fetchItems()
    } catch (error) {
      console.error('Error toggling active:', error)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('このアイテムを削除しますか？')) return
    try {
      await deleteDoc(doc(db, 'gachaItems', itemId))
      fetchItems()
    } catch (error) {
      console.error('Error deleting item:', error)
    }
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

  return (
    <div className="min-h-screen bg-hatofes-bg">
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
                      onChange={e => setNewItem(prev => ({ ...prev, rarity: e.target.value as GachaRarity }))}
                      className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                    >
                      <option value="common">コモン</option>
                      <option value="uncommon">アンコモン</option>
                      <option value="rare">レア</option>
                      <option value="epic">イピック</option>
                      <option value="legendary">レジェンダリー</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-hatofes-gray mb-1">重み（高い = 出る確率高い）</label>
                  <input
                    type="number"
                    value={newItem.weight}
                    onChange={e => setNewItem(prev => ({ ...prev, weight: parseInt(e.target.value) || 1 }))}
                    className="w-32 bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-hatofes-white"
                  />
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

        {/* Item List */}
        <div className="card">
          <h2 className="text-lg font-bold text-hatofes-white mb-4">アイテム一覧</h2>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner size="lg" /></div>
          ) : items.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">アイテムがありません</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-hatofes-dark p-4 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-hatofes-white font-medium">{item.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded border ${RARITY_COLORS[item.rarity]}`}>
                          {item.rarity}
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
                        重み: {item.weight}
                        {item.type === 'points' && item.pointsValue ? ` / ポイント: ${item.pointsValue}` : ''}
                        {item.type === 'ticket' && item.ticketValue ? ` / チケット: ${item.ticketValue}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
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
      </main>
    </div>
  )
}
