import { Timestamp } from 'firebase/firestore';

// User roles
export type UserRole = 'student' | 'teacher' | 'staff' | 'admin';

// User document
export interface User {
  email: string;
  grade?: number; // 1-3, optional for teachers/staff
  class?: string; // A-H, optional for teachers/staff
  studentNumber?: number; // 名簿番号, optional for teachers/staff
  username: string;
  realName?: string; // staff/admin用の本名（通知・アンケートで表示）
  profileImageUrl?: string; // プロフィール画像URL (Cloudflare R2)
  role: UserRole;
  department?: string; // 係（権限なし、表示のみ）例: 広報係、会計係など
  totalPoints: number;
  createdAt: Timestamp;
  lastLoginDate: string; // YYYY-MM-DD format
  // Settings (undefined → use default)
  notificationsEnabled?: boolean; // default: true
  theme?: 'dark' | 'light'; // default: 'dark'
  usernameChangeCount?: number; // default: 0, max: 3
  // Gacha
  gachaTickets?: number; // default: 0
  // Survey optimization
  answeredSurveyIds?: string[]; // Array of survey IDs the user has answered (cached for performance)
  // Login streak
  loginStreak?: number; // Current consecutive login days
  lastStreakDate?: string; // YYYY-MM-DD of last streak update
  // Badge system
  badges?: string[]; // Array of badge IDs earned
  recentPointHistory?: PointHistorySummary[]; // Cached recent point history for low-cost UI reads
}

// Feedback document
export interface Feedback {
  userId: string;
  username: string;
  message: string;
  createdAt: Timestamp;
}

// Point history reasons
export type PointReason = 'login_bonus' | 'survey' | 'admin_grant' | 'admin_deduct' | 'admin_clear' | 'game_result';

// Point history document
export interface PointHistory {
  id?: string; // Document ID (optional for creation, present after fetching)
  userId: string;
  points: number;
  reason: PointReason;
  details: string;
  grantedBy?: string; // User ID of admin who granted points
  createdAt: Timestamp;
}

export interface PointHistorySummary {
  id: string;
  points: number;
  reason: PointReason;
  details: string;
  createdAt: Timestamp;
}

// Class document
export interface Class {
  id?: string; // Document ID (optional for creation, present after fetching)
  grade: number;
  className: string; // A-H
  totalPoints: number;
  memberCount: number;
  memberIds?: string[]; // Array of user IDs for efficient member lookup (cost optimization)
}

// Survey question types
export type QuestionType = 'multiple_choice' | 'text' | 'rating';

// Survey question
export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  required: boolean;
  options?: string[]; // For multiple_choice
  imageUrl?: string;
  minRating?: number; // For rating
  maxRating?: number; // For rating
}

// Survey status
export type SurveyStatus = 'active' | 'closed';

// Survey category
export type SurveyCategory = 'task' | 'mission';

// Survey document
export interface Survey {
  id?: string; // Document ID (optional for creation, present after fetching)
  title: string;
  description: string;
  questions: Question[];
  points: number; // Points awarded for completion
  startDate: Timestamp;
  endDate: Timestamp;
  status: SurveyStatus;
  category: SurveyCategory; // task = 全員対象（必須系）, mission = 任意参加（挑戦系）
  createdBy: string; // User ID
}

// Survey response answer
export interface Answer {
  questionId: string;
  value: string | number; // string for text/choice, number for rating
}

// Survey response document
export interface SurveyResponse {
  surveyId: string;
  userId: string;
  answers: Answer[];
  submittedAt: Timestamp;
  pointsAwarded: number;
}

// News category
export type NewsCategory = 'general' | 'event' | 'announcement';

// News document
export interface News {
  title: string;
  content: string;
  category: NewsCategory;
  publishedAt: Timestamp;
  createdBy: string; // User ID
  isPinned: boolean;
}

// Notification document
export interface Notification {
  title: string;
  message: string;
  targetUsers: string[]; // Empty array means all users
  targetRoles: UserRole[]; // Empty array means all roles
  createdAt: Timestamp;
  createdBy?: string; // User ID of creator
  senderName?: string; // Display name of sender (realName or username)
  senderRole?: UserRole;
  senderDepartment?: string;
  senderProfileImageUrl?: string;
  readCount: number; // Count of users who have read (replaces readBy array for cost optimization)
  readBy?: string[]; // DEPRECATED: Legacy field, use readStatus subcollection instead
  imageUrl?: string;
  points?: number; // 通知を開いた時に付与するポイント（0または未設定 = 付与なし）
  pointsReceivedBy?: string[]; // ポイントを受け取ったユーザーIDの配列
  isImportant?: boolean; // ホームの重要なお知らせに優先表示
}

// Notification read status (stored in subcollection: notifications/{notifId}/readStatus/{userId})
export interface NotificationReadStatus {
  readAt: Timestamp;
  pointsClaimed: boolean; // Whether the user has claimed points from this notification
}

// Gacha item types
export type GachaItemType = 'badge' | 'coupon' | 'points' | 'ticket' | 'custom';
export type GachaRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface GachaItem {
  id?: string;
  name: string;
  description: string;
  type: GachaItemType;
  pointsValue?: number;
  ticketValue?: number;
  rarity: GachaRarity;
  weight: number;
  imageUrl?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

export interface GachaHistoryEntry {
  id?: string;
  userId: string;
  itemId: string;
  itemName: string;
  itemRarity: GachaRarity;
  pulledAt: Timestamp;
}

export interface TicketHistoryEntry {
  id?: string;
  userId: string;
  tickets: number;
  reason: 'admin_grant' | 'gacha_pull' | 'gacha_item_reward';
  details: string;
  grantedBy?: string;
  createdAt: Timestamp;
}

// Tetris score document
export interface TetrisScore {
  id?: string;
  userId: string;
  username: string;
  profileImageUrl?: string; // プロフィール画像URL
  grade?: number;
  class?: string;
  highScore: number; // 最高スコア
  maxLines: number; // 最高消し行数
  totalGames: number; // プレイ回数
  lastPlayedAt: Timestamp;
}

// Festival date config (for countdown)
export interface FestivalDateConfig {
  startDate: Timestamp;
  endDate: Timestamp;
  countdownEnabled: boolean;
  message?: string;
}

// Booth document (for booth list on festival day)
export type BoothCategory = 'food' | 'game' | 'exhibition' | 'stage' | 'other';

export interface Booth {
  id?: string;
  name: string;
  classId: string; // "2-A" etc
  location: string;
  floor?: number;
  description?: string;
  category: BoothCategory;
  imageUrl?: string;
  stampCode?: string; // QR code identifier for stamp rally
  points?: number; // Points awarded for visiting (stamp rally)
  isActive: boolean;
  createdAt: Timestamp;
  createdBy: string;
}

// Event document (for event schedule)
export type EventCategory = 'stage' | 'exhibition' | 'food' | 'game' | 'ceremony' | 'other';

export interface FestivalEvent {
  id?: string;
  title: string;
  description?: string;
  location: string;
  category: EventCategory;
  startTime: Timestamp;
  endTime: Timestamp;
  isHighlight?: boolean;
  createdAt: Timestamp;
  createdBy: string;
}

// Stamp rally entry
export interface StampRallyEntry {
  id?: string;
  userId: string;
  boothId: string;
  visitedAt: Timestamp;
  pointsAwarded: number;
}

// Radio config (for Hato Radio)
export interface RadioConfig {
  isLive: boolean;
  currentStreamUrl: string;
  streamType: 'youtube' | 'external' | 'archive';
  announcement?: string;
  requestsEnabled: boolean;
}

// Radio program
export interface RadioProgram {
  id?: string;
  title: string;
  hosts: string[];
  description?: string;
  scheduledStart: Timestamp;
  scheduledEnd: Timestamp;
  streamUrl?: string;
  isLive?: boolean;
}

// Radio request
export type RadioRequestStatus = 'pending' | 'approved' | 'played' | 'rejected';

export interface RadioRequest {
  id?: string;
  userId: string;
  username: string;
  songTitle: string;
  artist?: string;
  message?: string;
  status: RadioRequestStatus;
  createdAt: Timestamp;
}

// Executive Q&A config
export interface ExecutiveConfig {
  executiveUserIds: string[]; // User IDs of executives (1 chair + 2 vice chairs)
  executiveNames?: string[]; // Display names for executives
  meetingNotes?: string;
  lastUpdated?: Timestamp;
}

// Executive Q&A question
export interface ExecutiveQuestion {
  id?: string;
  question: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt: Timestamp;
  answer?: string;
  answeredBy?: string;
  answeredByName?: string;
  answeredAt?: Timestamp;
  isPinned?: boolean;
  likes: number;
  likedBy: string[];
  status: 'pending' | 'answered';
}

// Notification reactions (stored in notifications/{notifId}/reactions/{userId})
export interface NotificationReaction {
  emoji: string;
  reactedAt: Timestamp;
}

// Booth review
export interface BoothReview {
  id?: string;
  boothId: string;
  userId: string;
  username: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Timestamp;
}

// Live challenge (class vs class time attack)
export interface LiveChallenge {
  id?: string;
  title: string;
  description?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  status: 'upcoming' | 'active' | 'ended';
  bonusPoints?: number; // Points for winning class
  createdBy: string;
}

// Live challenge class score (subcollection: liveChallenges/{id}/classScores/{classId})
export interface LiveChallengeClassScore {
  classId: string;
  grade: number;
  className: string;
  totalPoints: number;
  memberCount: number;
}

// Tetris daily challenge
export interface TetrisDailyChallenge {
  id?: string;
  date: string; // YYYY-MM-DD
  targetType: 'lines' | 'score';
  targetValue: number;
  timeLimit?: number; // seconds
  bonusPoints: number;
  description: string;
}

// Extended question types for surveys
export type ExtendedQuestionType =
  | 'multiple_choice'
  | 'text'
  | 'rating'
  | 'image_choice'
  | 'slider'
  | 'ranking'
  | 'checkbox'
  | 'long_text'
  | 'datetime';

// Extended question interface
export interface ExtendedQuestion {
  id: string;
  type: ExtendedQuestionType;
  question: string;
  required: boolean;
  options?: string[]; // For multiple_choice, checkbox
  imageOptions?: Array<{ url: string; label: string }>; // For image_choice
  imageUrl?: string;
  minRating?: number; // For rating
  maxRating?: number; // For rating
  minValue?: number; // For slider
  maxValue?: number; // For slider
  step?: number; // For slider
  rankingItems?: string[]; // For ranking
  maxLength?: number; // For text/long_text
  placeholder?: string;
  // Conditional logic
  showIf?: {
    questionId: string;
    value: string | number;
  };
}
