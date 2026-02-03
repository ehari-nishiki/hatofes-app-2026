// モックデータ - 開発中はこのデータを使用
// 後でFirestoreに切り替え

export interface User {
  id: string
  email: string
  username: string
  grade: number
  class: string
  studentNumber: number
  role: 'student' | 'teacher' | 'staff' | 'admin'
  totalPoints: number
  createdAt: string
  lastLoginDate: string
}

export interface PointHistory {
  id: string
  userId: string
  points: number
  reason: 'login_bonus' | 'survey' | 'admin_grant' | 'game_result'
  details: string
  grantedBy?: string
  date: string
}

export interface Survey {
  id: string
  title: string
  description: string
  points: number
  status: 'active' | 'closed'
  startDate: string
  endDate: string
}

export interface ClassData {
  id: string
  grade: number
  className: string
  totalPoints: number
  memberCount: number
}

// ユーザーデータ
export const mockUser: User = {
  id: 'user-001',
  email: 'test@g.nagano-c.ed.jp',
  username: '勇敢な虹色の鳩',
  grade: 2,
  class: 'A',
  studentNumber: 15,
  role: 'student',
  totalPoints: 1250,
  createdAt: '2025-01-01T00:00:00Z',
  lastLoginDate: '2025-02-01',
}

// ポイント履歴
export const mockPointHistory: PointHistory[] = [
  {
    id: 'ph-001',
    userId: 'user-001',
    points: 10,
    reason: 'login_bonus',
    details: '1日1回のログインボーナス',
    date: '2025-02-01',
  },
  {
    id: 'ph-002',
    userId: 'user-001',
    points: 50,
    reason: 'survey',
    details: '第1回アンケート回答',
    date: '2025-01-31',
  },
  {
    id: 'ph-003',
    userId: 'user-001',
    points: 100,
    reason: 'admin_grant',
    details: '文化祭準備参加ボーナス',
    grantedBy: 'admin-001',
    date: '2025-01-30',
  },
  {
    id: 'ph-004',
    userId: 'user-001',
    points: 10,
    reason: 'login_bonus',
    details: '1日1回のログインボーナス',
    date: '2025-01-30',
  },
  {
    id: 'ph-005',
    userId: 'user-001',
    points: 30,
    reason: 'survey',
    details: '好きな出し物アンケート',
    date: '2025-01-29',
  },
]

// アンケートデータ
export const mockSurveys: Survey[] = [
  {
    id: 'survey-001',
    title: '鳩祭に期待すること',
    description: '今年の鳩祭で楽しみにしていることを教えてください',
    points: 30,
    status: 'active',
    startDate: '2025-02-01',
    endDate: '2025-02-15',
  },
  {
    id: 'survey-002',
    title: '出店メニュー人気投票',
    description: 'あなたが食べたい出店メニューに投票してください',
    points: 20,
    status: 'active',
    startDate: '2025-02-01',
    endDate: '2025-02-28',
  },
  {
    id: 'survey-003',
    title: '第1回アンケート',
    description: '文化祭の満足度調査',
    points: 50,
    status: 'closed',
    startDate: '2025-01-15',
    endDate: '2025-01-31',
  },
]

// クラスランキング
export const mockClassRanking: ClassData[] = [
  { id: '2-C', grade: 2, className: 'C', totalPoints: 15420, memberCount: 40 },
  { id: '3-A', grade: 3, className: 'A', totalPoints: 14890, memberCount: 38 },
  { id: '1-B', grade: 1, className: 'B', totalPoints: 13560, memberCount: 41 },
  { id: '2-A', grade: 2, className: 'A', totalPoints: 12800, memberCount: 39 },
  { id: '3-D', grade: 3, className: 'D', totalPoints: 11950, memberCount: 40 },
]

// ユーザーネーム生成用単語リスト
export const usernameWords = {
  adjectives: [
    '勇敢な', '優しい', '元気な', '静かな', '明るい',
    '輝く', '素敵な', '愉快な', '不思議な', '神秘的な',
  ],
  colors: [
    '虹色の', '金色の', '銀色の', '蒼い', '紅い',
    '翠の', '紫の', '琥珀色の', '桜色の', '空色の',
  ],
  animals: [
    '鳩', 'タカ', 'フクロウ', 'ワシ', 'ツバメ',
    'カラス', 'スズメ', 'ペンギン', 'インコ', 'オウム',
  ],
}

// ユーザーネーム生成関数
export function generateUsername(): string {
  const { adjectives, colors, animals } = usernameWords
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const color = colors[Math.floor(Math.random() * colors.length)]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  return `${adj}${color}${animal}`
}
