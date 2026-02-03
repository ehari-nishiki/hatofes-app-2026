// 認証・登録関連の型定義

export interface RegistrationData {
  // Google認証から取得
  email: string
  googleUid: string

  // ユーザー入力
  grade: number | 'teacher'  // 1, 2, 3, or 'teacher'
  classNumber: string        // '1'-'7', 'A', 'B'
  studentNumber: number      // 1-41

  // ユーザーネーム生成用
  word1: string  // リストA（食材1）
  word2: string  // リストB（食材2）
  word3: string  // リストC（料理）

  // 生成されたユーザーネーム
  username: string
}

export interface User {
  id: string
  email: string
  username: string
  grade: number | 'teacher'
  classNumber: string
  studentNumber: number
  role: 'student' | 'teacher' | 'staff' | 'admin'
  totalPoints: number
  createdAt: Date
  lastLoginDate: string
}

// 登録ステップの定義
export type RegistrationStep =
  | 'initial'      // ログイン/新規登録選択
  | 'google-auth'  // Googleログイン
  | 'grade'        // 学年選択
  | 'class'        // クラス選択
  | 'student-number' // 名簿番号選択
  | 'word1'        // 食材1選択
  | 'word2'        // 食材2選択
  | 'word3'        // 料理選択
  | 'loading'      // 登録処理中
  | 'success'      // 登録完了
  | 'error'        // エラー

// 登録コンテキストの状態
export interface RegistrationState {
  step: RegistrationStep
  data: Partial<RegistrationData>
  error?: string
}
