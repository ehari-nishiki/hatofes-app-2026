import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface AuthErrorContext {
  url: string;
  userAgent: string;
  timestamp: Timestamp;
  email?: string;
  step: 'auth' | 'firestore' | 'navigation' | 'registration';
}

export interface AuthErrorLog {
  userId?: string;
  errorCode: string;
  errorMessage: string;
  stackTrace: string;
  context: AuthErrorContext;
}

export const AUTH_ERRORS = {
  AUTH_001: {
    code: 'AUTH_001',
    message: 'ドメイン不一致（@g.nagano-c.ed.jp 以外）',
    locations: ['AuthContext L85-92', 'GoogleAuthPage L64-71', 'firebase.ts L26-28']
  },
  AUTH_002: {
    code: 'AUTH_002',
    message: 'Firestore Permission Denied',
    locations: ['AuthContext L135-140 onSnapshot error']
  },
  AUTH_003: {
    code: 'AUTH_003',
    message: 'ユーザードキュメント不存在',
    locations: ['AuthContext L127-130']
  },
  AUTH_004: {
    code: 'AUTH_004',
    message: 'Race Condition（processingAuth）',
    locations: ['GoogleAuthPage L18-40']
  },
  AUTH_005: {
    code: 'AUTH_005',
    message: 'Project ID不一致（.env vs .env.example）',
    locations: ['.env vs .env.example']
  },
  AUTH_006: {
    code: 'AUTH_006',
    message: 'Config未設定（domainRestriction）',
    locations: ['firestore.rules L14']
  },
  AUTH_007: {
    code: 'AUTH_007',
    message: 'Google OAuth ポップアップブロック',
    locations: ['GoogleAuthPage L128']
  },
  AUTH_008: {
    code: 'AUTH_008',
    message: 'getRedirectResult null（モバイルリダイレクト後）',
    locations: ['GoogleAuthPage L60']
  },
  AUTH_009: {
    code: 'AUTH_009',
    message: 'Firestore書き込み失敗（登録時）',
    locations: ['useRegistration.ts L227-234']
  }
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERRORS;

/**
 * 認証エラーをFirestoreに記録する
 */
export async function logAuthError(
  errorCode: AuthErrorCode,
  error: unknown,
  context: Partial<AuthErrorContext> = {},
  userId?: string
): Promise<void> {
  try {
    const errorInfo = AUTH_ERRORS[errorCode];
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack || '' : '';

    const errorLog: AuthErrorLog = {
      userId,
      errorCode: errorInfo.code,
      errorMessage,
      stackTrace,
      context: {
        url: context.url || window.location.href,
        userAgent: context.userAgent || navigator.userAgent,
        timestamp: context.timestamp || Timestamp.now(),
        email: context.email,
        step: context.step || 'auth',
      },
    };

    await addDoc(collection(db, 'authErrors'), errorLog);
    console.error(`[${errorCode}] ${errorInfo.message}:`, error);
  } catch (loggingError) {
    // エラーログ記録自体が失敗しても、メインフローに影響させない
    console.error('Failed to log auth error:', loggingError);
  }
}

/**
 * エラーコードから詳細情報を取得
 */
export function getErrorDetails(errorCode: AuthErrorCode) {
  return AUTH_ERRORS[errorCode];
}
