// レベルシステム - より難易度の高い閾値

export const LEVEL_THRESHOLDS = [
  0,       // Level 1
  200,     // Level 2
  500,     // Level 3
  1000,    // Level 4
  2000,    // Level 5
  3500,    // Level 6
  5500,    // Level 7
  8000,    // Level 8
  12000,   // Level 9
  18000,   // Level 10 (max)
]

export const MAX_LEVEL = LEVEL_THRESHOLDS.length

// ポイントからレベルを計算
export function calculateLevel(points: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      return i + 1
    }
  }
  return 1
}

// 次のレベルに必要なポイントを取得
export function getPointsToNextLevel(points: number): { current: number; next: number; progress: number } | null {
  const level = calculateLevel(points)

  if (level >= MAX_LEVEL) {
    return null // 最高レベルに達している
  }

  const currentThreshold = LEVEL_THRESHOLDS[level - 1]
  const nextThreshold = LEVEL_THRESHOLDS[level]
  const progress = ((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100

  return {
    current: points - currentThreshold,
    next: nextThreshold - currentThreshold,
    progress: Math.min(100, Math.max(0, progress)),
  }
}

// 現在のレベルの閾値を取得
export function getLevelThreshold(level: number): number {
  return LEVEL_THRESHOLDS[Math.min(level - 1, LEVEL_THRESHOLDS.length - 1)]
}

// レベルに対応するタイトル（英語）
export const LEVEL_TITLES: Record<number, string> = {
  1: 'ROOKIE',
  2: 'BEGINNER',
  3: 'AMATEUR',
  4: 'RISING',
  5: 'PRO',
  6: 'EXPERT',
  7: 'MASTER',
  8: 'GRANDMASTER',
  9: 'LEGEND',
  10: 'DIVINE',
}

// レベルに対応する色（グラデーション用 - より深みのある配色）
export const LEVEL_COLORS: Record<number, { from: string; to: string; mid?: string }> = {
  1: { from: '#6b7280', to: '#9ca3af' },
  2: { from: '#22c55e', to: '#4ade80' },
  3: { from: '#3b82f6', to: '#60a5fa' },
  4: { from: '#8b5cf6', to: '#a78bfa' },
  5: { from: '#ec4899', to: '#f472b6' },
  6: { from: '#f97316', to: '#fb923c' },
  7: { from: '#dc2626', to: '#ef4444' },
  8: { from: '#c026d3', to: '#e879f9' },
  9: { from: '#7c3aed', to: '#a78bfa' },
  10: { from: '#FFC300', to: '#FF4E00' },
}
