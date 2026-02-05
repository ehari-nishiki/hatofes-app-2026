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
  role: UserRole;
  totalPoints: number;
  createdAt: Timestamp;
  lastLoginDate: string; // YYYY-MM-DD format
  // Settings (undefined → use default)
  notificationsEnabled?: boolean; // default: true
  theme?: 'dark' | 'light'; // default: 'dark'
  usernameChangeCount?: number; // default: 0, max: 3
  // Gacha
  gachaTickets?: number; // default: 0
}

// Feedback document
export interface Feedback {
  userId: string;
  username: string;
  message: string;
  createdAt: Timestamp;
}

// Point history reasons
export type PointReason = 'login_bonus' | 'survey' | 'admin_grant' | 'game_result';

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

// Class document
export interface Class {
  id?: string; // Document ID (optional for creation, present after fetching)
  grade: number;
  className: string; // A-H
  totalPoints: number;
  memberCount: number;
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
  readBy: string[]; // Array of user IDs who have read
  imageUrl?: string;
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
