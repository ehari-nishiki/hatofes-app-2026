// Badge definitions and checking logic

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // SVG path or emoji
  color: string; // Gradient from color
  colorTo: string; // Gradient to color
  category: 'streak' | 'gacha' | 'game' | 'social' | 'special';
}

export const BADGES: BadgeDefinition[] = [
  // Streak badges
  {
    id: 'streak_3',
    name: '3日連続ログイン',
    description: '3日連続でログインした',
    icon: '🔥',
    color: '#FF6B35',
    colorTo: '#FF9F1C',
    category: 'streak',
  },
  {
    id: 'streak_7',
    name: '1週間連続ログイン',
    description: '7日連続でログインした',
    icon: '🔥',
    color: '#FF4500',
    colorTo: '#FF6B35',
    category: 'streak',
  },
  {
    id: 'streak_14',
    name: '2週間連続ログイン',
    description: '14日連続でログインした',
    icon: '💪',
    color: '#E63946',
    colorTo: '#FF4500',
    category: 'streak',
  },
  {
    id: 'streak_30',
    name: '30日連続ログイン',
    description: '30日連続でログインした',
    icon: '👑',
    color: '#FFD700',
    colorTo: '#FF8C00',
    category: 'streak',
  },
  // Gacha badges
  {
    id: 'first_gacha',
    name: '初ガチャ',
    description: '初めてガチャを引いた',
    icon: '🎰',
    color: '#A855F7',
    colorTo: '#6366F1',
    category: 'gacha',
  },
  {
    id: 'gacha_legendary',
    name: 'レジェンド獲得',
    description: 'レジェンダリーアイテムを獲得した',
    icon: '✨',
    color: '#FFD700',
    colorTo: '#FFA500',
    category: 'gacha',
  },
  {
    id: 'gacha_collector_50',
    name: 'コレクター',
    description: 'ガチャ図鑑の50%を達成した',
    icon: '📚',
    color: '#10B981',
    colorTo: '#059669',
    category: 'gacha',
  },
  {
    id: 'gacha_collector_100',
    name: 'コンプリート',
    description: 'ガチャ図鑑を100%コンプリートした',
    icon: '🏆',
    color: '#FFD700',
    colorTo: '#FF4500',
    category: 'gacha',
  },
  // Game badges
  {
    id: 'tetris_1000',
    name: 'テトリスマスター',
    description: 'テトリスで1000点以上達成した',
    icon: '🧩',
    color: '#00D4FF',
    colorTo: '#3A7BD5',
    category: 'game',
  },
  {
    id: 'tetris_5000',
    name: 'テトリスレジェンド',
    description: 'テトリスで5000点以上達成した',
    icon: '🧩',
    color: '#FFD700',
    colorTo: '#00D4FF',
    category: 'game',
  },
  // Social badges
  {
    id: 'all_tasks_done',
    name: '全タスク完了',
    description: '全てのタスクを完了した',
    icon: '✅',
    color: '#10B981',
    colorTo: '#34D399',
    category: 'social',
  },
  {
    id: 'all_missions_done',
    name: '全ミッション達成',
    description: '全てのミッションを達成した',
    icon: '🎯',
    color: '#F59E0B',
    colorTo: '#EF4444',
    category: 'social',
  },
  // Special badges
  {
    id: 'stamp_rally_complete',
    name: 'スタンプラリー制覇',
    description: '全ブースのスタンプを集めた',
    icon: '🗺️',
    color: '#8B5CF6',
    colorTo: '#EC4899',
    category: 'special',
  },
  {
    id: 'early_bird',
    name: 'アーリーバード',
    description: '文化祭初日に最初の100人にログインした',
    icon: '🐦',
    color: '#06B6D4',
    colorTo: '#3B82F6',
    category: 'special',
  },
];

export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGES.find(b => b.id === id);
}

export function getBadgesByCategory(category: BadgeDefinition['category']): BadgeDefinition[] {
  return BADGES.filter(b => b.category === category);
}

// Streak milestones that award bonus points
export const STREAK_MILESTONES: Record<number, number> = {
  3: 20,
  7: 50,
  14: 100,
  30: 300,
};

export function getStreakBadgeId(streak: number): string | null {
  if (streak >= 30) return 'streak_30';
  if (streak >= 14) return 'streak_14';
  if (streak >= 7) return 'streak_7';
  if (streak >= 3) return 'streak_3';
  return null;
}
