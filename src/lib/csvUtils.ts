import type { PointHistory } from '../types/firestore'

export function exportTransactionsToCSV(
  transactions: Array<PointHistory & { id: string }>,
  username: string
) {
  // CSV header
  const headers = ['日時', '理由', '詳細', 'ポイント', '付与者']

  // CSV rows
  const rows = transactions.map(tx => {
    const date = tx.createdAt?.seconds
      ? new Date(tx.createdAt.seconds * 1000).toLocaleString('ja-JP')
      : ''

    const reasonLabels: Record<string, string> = {
      login_bonus: 'ログインボーナス',
      survey: 'アンケート',
      admin_grant: '管理者付与',
      admin_deduct: '管理者剥奪',
      admin_clear: 'ポイントクリア',
      game_result: 'ゲーム結果',
    }

    return [
      date,
      reasonLabels[tx.reason] || tx.reason,
      tx.details,
      tx.points.toString(),
      tx.grantedBy === 'system' ? 'システム' : tx.grantedBy,
    ]
  })

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  // Create BOM for UTF-8
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })

  // Download
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${username}_ポイント履歴_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportUsersToCSV(
  users: Array<{
    username: string
    email: string
    grade?: number
    class?: string
    studentNumber?: number
    role: string
    totalPoints: number
  }>
) {
  // CSV header
  const headers = ['ユーザー名', 'メール', '学年', '組', '番号', 'ロール', 'ポイント']

  // CSV rows
  const rows = users.map(user => [
    user.username,
    user.email,
    user.grade?.toString() || '',
    user.class || '',
    user.studentNumber?.toString() || '',
    user.role,
    user.totalPoints.toString(),
  ])

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  // Create BOM for UTF-8
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })

  // Download
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `ユーザー一覧_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// アンケート回答のCSVエクスポート
export function exportSurveyResponsesToCSV(
  surveyTitle: string,
  questions: Array<{ id: string; question: string }>,
  responses: Array<{
    username: string
    grade?: number
    class?: string
    studentNumber?: number
    answers: Record<string, string | number>
    submittedAt: { seconds: number }
  }>
) {
  // CSV header: ユーザー情報 + 各質問
  const headers = [
    '回答日時',
    'ユーザー名',
    '学年',
    '組',
    '番号',
    ...questions.map(q => q.question),
  ]

  // CSV rows
  const rows = responses.map(response => {
    const date = response.submittedAt?.seconds
      ? new Date(response.submittedAt.seconds * 1000).toLocaleString('ja-JP')
      : ''

    const userInfo = response.grade && response.class && response.studentNumber
      ? `${response.username} (${response.grade}-${response.class} ${response.studentNumber}番)`
      : response.username

    return [
      date,
      userInfo,
      response.grade?.toString() || '',
      response.class || '',
      response.studentNumber?.toString() || '',
      ...questions.map(q => String(response.answers[q.id] || '')),
    ]
  })

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  // Create BOM for UTF-8
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })

  // Download
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${surveyTitle}_回答一覧_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
