import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { grantPoints, deductPoints, clearPoints, getPointHistory, bulkGrantPoints, bulkDeductPoints } from '@/lib/pointService'
import { exportTransactionsToCSV, exportUsersToCSV } from '@/lib/csvUtils'
import type { PointHistory } from '@/types/firestore'

interface User {
  id: string
  email: string
  username: string
  grade?: number
  class?: string
  studentNumber?: number
  role: string
  totalPoints: number
}

type Tab = 'grant' | 'deduct' | 'clear' | 'bulk' | 'transactions'

const TAB_LABELS: Record<Tab, string> = {
  grant: '付与',
  deduct: '剥奪',
  clear: 'クリア',
  bulk: '一括操作',
  transactions: 'トランザクション',
}

const REASON_PRESETS = {
  grant: [
    'イベント参加ボーナス',
    '出席ボーナス',
    '活動貢献',
    '特別表彰',
    '補正・調整',
  ],
  deduct: [
    'ポイント操作のため',
    '不正利用',
    '補正・調整',
    'ルール違反',
  ],
}

export default function AdminPointsPage() {
  const { currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [tab, setTab] = useState<Tab>('grant')
  const [points, setPoints] = useState(10)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchMode, setSearchMode] = useState<'text' | 'structured'>('text')
  const [searchGrade, setSearchGrade] = useState<number | null>(null)
  const [searchClass, setSearchClass] = useState('')
  const [searchStudentNumber, setSearchStudentNumber] = useState<number | null>(null)

  // Transactions
  const [transactions, setTransactions] = useState<Array<PointHistory & { id: string }>>([])
  const [txLoading, setTxLoading] = useState(false)
  const [txFilterReason, setTxFilterReason] = useState<string>('all')
  const [txFilterType, setTxFilterType] = useState<'all' | 'positive' | 'negative'>('all')
  const [txStartDate, setTxStartDate] = useState<string>('')
  const [txEndDate, setTxEndDate] = useState<string>('')

  // Bulk operations
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<'grant' | 'deduct'>('grant')
  const [bulkResult, setBulkResult] = useState<{ successCount: number; totalCount: number; errors?: string[] } | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('username'))
        const snap = await getDocs(q)
        const list: User[] = []
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() } as User)
        })
        setUsers(list)
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  // Load transactions when user selected and on transactions tab
  useEffect(() => {
    if (tab !== 'transactions' || !selectedUser) {
      setTransactions([])
      return
    }
    const load = async () => {
      setTxLoading(true)
      try {
        const history = await getPointHistory(selectedUser.id, 50)
        setTransactions(history)
      } catch (e) {
        console.error('Failed to load transactions:', e)
      } finally {
        setTxLoading(false)
      }
    }
    load()
  }, [tab, selectedUser])

  // Optimized: only refresh specific user instead of all users
  const refreshUser = useCallback(async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (userDoc.exists()) {
        const updatedUser = { id: userDoc.id, ...userDoc.data() } as User
        setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
        if (selectedUser?.id === userId) {
          setSelectedUser(updatedUser)
        }
      }
    } catch (error) {
      console.error('Error refreshing user:', error)
    }
  }, [selectedUser])

  // Bulk refresh for multiple users (after bulk operations)
  const refreshMultipleUsers = useCallback(async (userIds: string[]) => {
    try {
      // Batch fetch users (Firestore IN query limit is 30)
      const batchSize = 30
      const updatedUsers: User[] = []

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize)
        const promises = batch.map(id => getDoc(doc(db, 'users', id)))
        const docs = await Promise.all(promises)
        docs.forEach(docSnap => {
          if (docSnap.exists()) {
            updatedUsers.push({ id: docSnap.id, ...docSnap.data() } as User)
          }
        })
      }

      // Update state with new user data
      const updatedMap = new Map(updatedUsers.map(u => [u.id, u]))
      setUsers(prev => prev.map(u => updatedMap.get(u.id) || u))

      // Update selectedUser if in the list
      if (selectedUser && updatedMap.has(selectedUser.id)) {
        setSelectedUser(updatedMap.get(selectedUser.id)!)
      }
    } catch (error) {
      console.error('Error refreshing users:', error)
    }
  }, [selectedUser])

  const handleGrantPoints = async () => {
    if (!selectedUser || points <= 0 || !currentUser) return
    setSubmitting(true)
    setMessage(null)
    try {
      await grantPoints(selectedUser.id, points, 'admin_grant', reason || '管理者による付与')
      setMessage({ type: 'success', text: `${selectedUser.username} に ${points}pt を付与しました` })
      setPoints(10)
      setReason('')
      await refreshUser(selectedUser.id)
    } catch (error) {
      console.error('Error granting points:', error)
      setMessage({ type: 'error', text: 'ポイント付与に失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeductPoints = async () => {
    if (!selectedUser || points <= 0 || !currentUser) return
    setSubmitting(true)
    setMessage(null)
    try {
      const result = await deductPoints(selectedUser.id, points, 'admin_deduct', reason || '管理者による剥奪')
      setMessage({ type: 'success', text: `${selectedUser.username} から ${result.actualDeducted}pt を剥奪しました` })
      setPoints(10)
      setReason('')
      await refreshUser(selectedUser.id)
    } catch (error) {
      console.error('Error deducting points:', error)
      setMessage({ type: 'error', text: 'ポイント剥奪に失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearPoints = async () => {
    if (!selectedUser || !currentUser) return
    if (!confirm(`${selectedUser.username} のポイント（${selectedUser.totalPoints.toLocaleString()}pt）を全てクリアしますか？`)) return
    setSubmitting(true)
    setMessage(null)
    try {
      const result = await clearPoints(selectedUser.id)
      setMessage({ type: 'success', text: `${selectedUser.username} の ${result.clearedAmount}pt をクリアしました` })
      await refreshUser(selectedUser.id)
    } catch (error) {
      console.error('Error clearing points:', error)
      setMessage({ type: 'error', text: 'ポイントクリアに失敗しました' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkOperation = async () => {
    if (selectedUserIds.length === 0 || points <= 0 || !currentUser) return
    if (!confirm(`${selectedUserIds.length}人のユーザーに${points}ptを${bulkAction === 'grant' ? '付与' : '剥奪'}しますか？`)) return

    setSubmitting(true)
    setMessage(null)
    setBulkResult(null)
    try {
      const result = bulkAction === 'grant'
        ? await bulkGrantPoints(selectedUserIds, points, 'admin_grant', reason || '一括付与')
        : await bulkDeductPoints(selectedUserIds, points, 'admin_deduct', reason || '一括剥奪')

      setBulkResult(result)
      setMessage({ type: 'success', text: result.message })
      setPoints(10)
      setReason('')
      await refreshMultipleUsers(selectedUserIds)
    } catch (error: any) {
      console.error('Error in bulk operation:', error)
      const errorMessage = error?.message || error?.toString() || '一括操作に失敗しました'
      setMessage({ type: 'error', text: `エラー: ${errorMessage}` })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const toggleAllUsers = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id))
    }
  }

  const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', 'A', 'B']

  // Memoize filtered users to avoid recalculation on every render
  const filteredUsers = useMemo(() => {
    if (searchMode === 'text') {
      const term = searchTerm.toLowerCase()
      return users.filter(u =>
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.grade && u.class && `${u.grade}-${u.class}`.includes(searchTerm)) ||
        (u.studentNumber != null && String(u.studentNumber).includes(searchTerm))
      )
    }
    return users.filter(u =>
      (searchGrade == null || u.grade === searchGrade) &&
      (!searchClass || u.class === searchClass) &&
      (searchStudentNumber == null || u.studentNumber === searchStudentNumber)
    )
  }, [users, searchMode, searchTerm, searchGrade, searchClass, searchStudentNumber])

  const reasonLabel = {
    login_bonus: 'ログインボーナス',
    survey: 'アンケート',
    admin_grant: '管理者付与',
    admin_deduct: '管理者剥奪',
    admin_clear: 'ポイントクリア',
    game_result: 'ゲーム結果',
  } as const

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    // Filter by reason
    if (txFilterReason !== 'all' && tx.reason !== txFilterReason) return false

    // Filter by type (positive/negative)
    if (txFilterType === 'positive' && tx.points < 0) return false
    if (txFilterType === 'negative' && tx.points >= 0) return false

    // Filter by date range
    if (tx.createdAt?.seconds) {
      const txDate = new Date(tx.createdAt.seconds * 1000)
      if (txStartDate && txDate < new Date(txStartDate)) return false
      if (txEndDate) {
        const endDate = new Date(txEndDate)
        endDate.setHours(23, 59, 59, 999)
        if (txDate > endDate) return false
      }
    }

    return true
  })

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
            <h1 className="font-display text-xl font-bold text-hatofes-white">ポイント管理</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-hatofes-dark rounded-lg p-1">
          {(['grant', 'deduct', 'clear', 'bulk', 'transactions'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t
                  ? 'bg-hatofes-accent-yellow text-black'
                  : 'text-hatofes-gray hover:text-hatofes-white'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Action Form (付与・剥奪・クリア共通) */}
        {tab !== 'transactions' && tab !== 'bulk' && (
          <div className="card mb-8">
            <h2 className="text-lg font-bold text-hatofes-white mb-4">
              ポイントを{tab === 'grant' ? '付与' : tab === 'deduct' ? '剥奪' : 'クリアする'}
            </h2>

            {selectedUser ? (
              <div className="space-y-4">
                <div className="bg-hatofes-dark p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-hatofes-white font-medium">{selectedUser.username}</p>
                    <p className="text-sm text-hatofes-gray">
                      {selectedUser.grade && selectedUser.class ? `${selectedUser.grade}-${selectedUser.class}` : selectedUser.role}
                      {' / '}{selectedUser.totalPoints.toLocaleString()} pt
                    </p>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-hatofes-gray hover:text-hatofes-white">
                    変更
                  </button>
                </div>

                {tab === 'clear' ? (
                  <button
                    onClick={handleClearPoints}
                    disabled={submitting || selectedUser.totalPoints === 0}
                    className="btn-main w-full py-3 rounded-lg disabled:opacity-50 bg-red-600 hover:bg-red-700"
                  >
                    {submitting ? '処理中...' : selectedUser.totalPoints === 0 ? 'ポイントは既に0' : `${selectedUser.totalPoints.toLocaleString()}pt を全クリアする`}
                  </button>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm text-hatofes-gray mb-2">
                        {tab === 'grant' ? '付与' : '剥奪'}ポイント
                        {tab === 'deduct' && <span className="text-hatofes-gray/60 text-xs ml-2">（最大 {selectedUser.totalPoints.toLocaleString()}pt）</span>}
                      </label>
                      <input
                        type="number"
                        value={points}
                        onChange={e => setPoints(parseInt(e.target.value) || 0)}
                        min={1}
                        max={tab === 'deduct' ? selectedUser.totalPoints : undefined}
                        className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-hatofes-gray mb-2">理由（任意）</label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {REASON_PRESETS[tab as 'grant' | 'deduct']?.map(preset => (
                            <button
                              key={preset}
                              onClick={() => setReason(preset)}
                              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                reason === preset
                                  ? 'bg-hatofes-accent-yellow text-black font-medium'
                                  : 'bg-hatofes-dark text-hatofes-gray border border-hatofes-gray hover:text-hatofes-white hover:border-hatofes-accent-yellow'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                          placeholder="カスタム理由を入力..."
                          className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                        />
                      </div>
                    </div>

                    <button
                      onClick={tab === 'grant' ? handleGrantPoints : handleDeductPoints}
                      disabled={submitting || points <= 0}
                      className={`w-full py-3 rounded-lg disabled:opacity-50 ${
                        tab === 'grant' ? 'btn-main' : 'bg-red-600 hover:bg-red-700 text-white font-medium'
                      }`}
                    >
                      {submitting ? '処理中...' : `${points}pt を${tab === 'grant' ? '付与' : '剥奪'}する`}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-hatofes-gray">下のユーザー一覧からユーザーを選択してください</p>
            )}
          </div>
        )}

        {/* Bulk Operations Panel */}
        {tab === 'bulk' && (
          <div className="card mb-8">
            <h2 className="text-lg font-bold text-hatofes-white mb-4">一括ポイント操作</h2>

            <div className="space-y-4">
              {/* Action Type Selection */}
              <div className="flex gap-2">
                <button
                  onClick={() => setBulkAction('grant')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    bulkAction === 'grant'
                      ? 'bg-hatofes-accent-yellow text-black'
                      : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
                  }`}
                >
                  付与
                </button>
                <button
                  onClick={() => setBulkAction('deduct')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    bulkAction === 'deduct'
                      ? 'bg-red-600 text-white'
                      : 'bg-hatofes-dark text-hatofes-gray hover:text-hatofes-white'
                  }`}
                >
                  剥奪
                </button>
              </div>

              {/* Points Input */}
              <div>
                <label className="block text-sm text-hatofes-gray mb-2">
                  {bulkAction === 'grant' ? '付与' : '剥奪'}ポイント
                </label>
                <input
                  type="number"
                  value={points}
                  onChange={e => setPoints(parseInt(e.target.value) || 0)}
                  min={1}
                  className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                />
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-sm text-hatofes-gray mb-2">理由（任意）</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {REASON_PRESETS[bulkAction]?.map(preset => (
                      <button
                        key={preset}
                        onClick={() => setReason(preset)}
                        className={`text-xs px-3 py-1 rounded-full transition-colors ${
                          reason === preset
                            ? 'bg-hatofes-accent-yellow text-black font-medium'
                            : 'bg-hatofes-dark text-hatofes-gray border border-hatofes-gray hover:text-hatofes-white hover:border-hatofes-accent-yellow'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="カスタム理由を入力..."
                    className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-2 text-hatofes-white"
                  />
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div>
                <label className="block text-sm text-hatofes-gray mb-2">クイック選択</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    onClick={toggleAllUsers}
                    className="text-xs px-3 py-1 rounded-lg bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow"
                  >
                    {selectedUserIds.length === filteredUsers.length ? '全解除' : '全選択'}
                  </button>
                  {[1, 2, 3].map(grade => (
                    <button
                      key={grade}
                      onClick={() => {
                        const gradeUsers = users.filter(u => u.grade === grade)
                        setSelectedUserIds(gradeUsers.map(u => u.id))
                      }}
                      className="text-xs px-3 py-1 rounded-lg bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow"
                    >
                      {grade}年生全員
                    </button>
                  ))}
                </div>
                <p className="text-xs text-hatofes-gray">選択中: {selectedUserIds.length}人</p>
              </div>

              {/* Result Display */}
              {bulkResult && (
                <div className="bg-hatofes-dark p-4 rounded-lg">
                  <p className="text-hatofes-white font-medium mb-2">
                    成功: {bulkResult.successCount} / {bulkResult.totalCount}
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

              {/* Submit Button */}
              <button
                onClick={handleBulkOperation}
                disabled={submitting || points <= 0 || selectedUserIds.length === 0}
                className={`w-full py-3 rounded-lg font-medium disabled:opacity-50 ${
                  bulkAction === 'grant'
                    ? 'btn-main'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {submitting ? '処理中...' : `${selectedUserIds.length}人に${points}ptを${bulkAction === 'grant' ? '付与' : '剥奪'}`}
              </button>
            </div>
          </div>
        )}

        {/* Transactions Panel */}
        {tab === 'transactions' && (
          <div className="card mb-8">
            <h2 className="text-lg font-bold text-hatofes-white mb-3">トランザクション履歴</h2>
            {selectedUser ? (
              <>
                <div className="bg-hatofes-dark p-3 rounded-lg flex items-center justify-between mb-4">
                  <div>
                    <p className="text-hatofes-white font-medium">{selectedUser.username}</p>
                    <p className="text-sm text-hatofes-gray">現在のポイント: {selectedUser.totalPoints.toLocaleString()} pt</p>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-hatofes-gray hover:text-hatofes-white text-sm">
                    変更
                  </button>
                </div>

                {/* Filter UI */}
                {!txLoading && transactions.length > 0 && (
                  <div className="bg-hatofes-dark p-4 rounded-lg mb-4 space-y-3">
                    <p className="text-sm font-medium text-hatofes-white mb-2">フィルター</p>

                    {/* Reason Filter */}
                    <div>
                      <label className="block text-xs text-hatofes-gray mb-1">理由</label>
                      <select
                        value={txFilterReason}
                        onChange={e => setTxFilterReason(e.target.value)}
                        className="w-full bg-hatofes-gray-lighter border border-hatofes-gray rounded-lg px-3 py-2 text-sm text-hatofes-white"
                      >
                        <option value="all">すべて</option>
                        <option value="login_bonus">ログインボーナス</option>
                        <option value="survey">アンケート</option>
                        <option value="admin_grant">管理者付与</option>
                        <option value="admin_deduct">管理者剥奪</option>
                        <option value="admin_clear">ポイントクリア</option>
                        <option value="game_result">ゲーム結果</option>
                      </select>
                    </div>

                    {/* Type Filter */}
                    <div>
                      <label className="block text-xs text-hatofes-gray mb-1">種類</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'all', label: 'すべて' },
                          { value: 'positive', label: '増加のみ' },
                          { value: 'negative', label: '減少のみ' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setTxFilterType(opt.value as 'all' | 'positive' | 'negative')}
                            className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
                              txFilterType === opt.value
                                ? 'bg-hatofes-accent-yellow text-black font-medium'
                                : 'bg-hatofes-gray-lighter text-hatofes-gray hover:text-hatofes-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Date Range Filter */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-hatofes-gray mb-1">開始日</label>
                        <input
                          type="date"
                          value={txStartDate}
                          onChange={e => setTxStartDate(e.target.value)}
                          className="w-full bg-hatofes-gray-lighter border border-hatofes-gray rounded-lg px-2 py-1.5 text-xs text-hatofes-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-hatofes-gray mb-1">終了日</label>
                        <input
                          type="date"
                          value={txEndDate}
                          onChange={e => setTxEndDate(e.target.value)}
                          className="w-full bg-hatofes-gray-lighter border border-hatofes-gray rounded-lg px-2 py-1.5 text-xs text-hatofes-white"
                        />
                      </div>
                    </div>

                    {/* Clear Filters */}
                    <button
                      onClick={() => {
                        setTxFilterReason('all')
                        setTxFilterType('all')
                        setTxStartDate('')
                        setTxEndDate('')
                      }}
                      className="text-xs text-hatofes-gray hover:text-hatofes-white"
                    >
                      フィルターをクリア
                    </button>

                    <p className="text-xs text-hatofes-gray pt-2 border-t border-hatofes-gray/20">
                      表示中: {filteredTransactions.length} / {transactions.length} 件
                    </p>

                    {/* Export Button */}
                    <button
                      onClick={() => exportTransactionsToCSV(filteredTransactions, selectedUser.username)}
                      className="btn-sub w-full py-2 text-sm"
                    >
                      📥 CSVエクスポート
                    </button>
                  </div>
                )}

                {txLoading ? (
                  <p className="text-hatofes-gray text-center py-4">読み込み中...</p>
                ) : transactions.length === 0 ? (
                  <p className="text-hatofes-gray text-center py-4">履歴がありません</p>
                ) : filteredTransactions.length === 0 ? (
                  <p className="text-hatofes-gray text-center py-4">フィルター条件に一致する履歴がありません</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {filteredTransactions.map(tx => (
                      <div key={tx.id} className="bg-hatofes-dark p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                tx.points >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {reasonLabel[tx.reason] || tx.reason}
                              </span>
                              <p className="text-hatofes-gray text-xs truncate">{tx.details}</p>
                            </div>
                            <p className="text-hatofes-gray/50 text-xs mt-1">
                              {tx.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000).toLocaleString('ja-JP') : ''}
                            </p>
                          </div>
                          <span className={`font-bold font-display text-sm ${tx.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}pt
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-hatofes-gray">下のユーザー一覧からユーザーを選択してください</p>
            )}
          </div>
        )}

        {/* User List */}
        <div className="card">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-hatofes-white">ユーザー一覧</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => exportUsersToCSV(filteredUsers)}
                  className="text-xs px-3 py-1 rounded-full bg-hatofes-dark text-hatofes-gray border border-hatofes-gray hover:text-hatofes-white hover:border-hatofes-accent-yellow transition-colors"
                >
                  📥 CSV
                </button>
                <button
                  onClick={() => setSearchMode('text')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${searchMode === 'text' ? 'bg-hatofes-accent-yellow text-black' : 'bg-hatofes-dark text-hatofes-gray border border-hatofes-gray'}`}
                >キーワード</button>
                <button
                  onClick={() => setSearchMode('structured')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${searchMode === 'structured' ? 'bg-hatofes-accent-yellow text-black' : 'bg-hatofes-dark text-hatofes-gray border border-hatofes-gray'}`}
                >年組番号</button>
              </div>
            </div>
            {searchMode === 'text' ? (
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="ユーザー名・メール・年組・番号で検索..."
                className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-3 py-2 text-sm text-hatofes-white"
              />
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-hatofes-gray w-8 flex-shrink-0">学年</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map(g => (
                      <button
                        key={g}
                        onClick={() => setSearchGrade(searchGrade === g ? null : g)}
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${searchGrade === g ? 'bg-hatofes-accent-yellow text-black' : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow'}`}
                      >{g}年</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-hatofes-gray w-8 flex-shrink-0">組</label>
                  <div className="flex gap-1 flex-wrap">
                    {CLASS_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setSearchClass(searchClass === c ? '' : c)}
                        className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${searchClass === c ? 'bg-hatofes-accent-yellow text-black' : 'bg-hatofes-dark border border-hatofes-gray text-hatofes-white hover:border-hatofes-accent-yellow'}`}
                      >{c}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-hatofes-gray w-8 flex-shrink-0">番号</label>
                  <input
                    type="number"
                    value={searchStudentNumber ?? ''}
                    onChange={e => setSearchStudentNumber(e.target.value === '' ? null : parseInt(e.target.value))}
                    min={1}
                    max={40}
                    placeholder="番号"
                    className="w-20 bg-hatofes-dark border border-hatofes-gray rounded-lg px-2 py-1 text-sm text-hatofes-white placeholder-hatofes-gray"
                  />
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-hatofes-gray text-center py-4">読み込み中...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-hatofes-gray text-center py-4">ユーザーが見つかりません</p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredUsers.map(user => (
                tab === 'bulk' ? (
                  <div
                    key={user.id}
                    className={`p-3 rounded-lg transition-colors cursor-pointer ${
                      selectedUserIds.includes(user.id)
                        ? 'bg-hatofes-accent-yellow/20 border border-hatofes-accent-yellow'
                        : 'bg-hatofes-dark hover:bg-hatofes-gray-lighter'
                    }`}
                    onClick={() => toggleUserSelection(user.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-4 h-4"
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <p className="text-hatofes-white font-medium">{user.username}</p>
                        <p className="text-xs text-hatofes-gray">
                          {user.grade && user.class ? `${user.grade}-${user.class}` : user.role}
                          {' / '}{user.email}
                        </p>
                      </div>
                      <span className="text-gradient font-bold">{user.totalPoints.toLocaleString()} pt</span>
                    </div>
                  </div>
                ) : (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedUser?.id === user.id
                        ? 'bg-hatofes-accent-yellow/20 border border-hatofes-accent-yellow'
                        : 'bg-hatofes-dark hover:bg-hatofes-gray-lighter'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-hatofes-white font-medium">{user.username}</p>
                        <p className="text-xs text-hatofes-gray">
                          {user.grade && user.class ? `${user.grade}-${user.class}` : user.role}
                          {' / '}{user.email}
                        </p>
                      </div>
                      <span className="text-gradient font-bold">{user.totalPoints.toLocaleString()} pt</span>
                    </div>
                  </button>
                )
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
