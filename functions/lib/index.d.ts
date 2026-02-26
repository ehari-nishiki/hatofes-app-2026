import * as functions from 'firebase-functions/v2';
export declare const awardLoginBonus: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    points?: undefined;
    tickets?: undefined;
} | {
    success: boolean;
    message: string;
    points: any;
    tickets: any;
}>, unknown>;
export declare const updateLoginBonusConfig: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const grantPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const bulkGrantPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    errors: string[] | undefined;
}>, unknown>;
export declare const bulkDeductPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    totalDeducted: number;
    errors: string[] | undefined;
}>, unknown>;
export declare const submitSurveyResponse: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    pointsAwarded: number;
    message: string;
}>, unknown>;
export declare const updateUserRole: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const changeUsername: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    remainingChanges: number;
}>, unknown>;
export declare const grantGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const deductGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    actualDeducted: number;
}>, unknown>;
export declare const clearGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    clearedAmount: any;
}>, unknown>;
export declare const bulkGrantGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    errors: string[] | undefined;
}>, unknown>;
export declare const bulkDeductGachaTickets: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    totalDeducted: number;
    errors: string[] | undefined;
}>, unknown>;
export declare const deductPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    actualDeducted: number;
}>, unknown>;
export declare const clearPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    clearedAmount: any;
}>, unknown>;
export declare const getTodayTetrisStats: functions.https.CallableFunction<any, Promise<{
    totalToday: number;
    maxToday: number;
}>, unknown>;
export declare const registerTetrisRanking: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const resetTetrisRankings: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    deletedCount: number;
}>, unknown>;
export declare const submitTetrisScore: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    pointsAwarded: number;
    totalToday: number;
    maxToday: number;
    message?: undefined;
} | {
    success: boolean;
    pointsAwarded: number;
    totalToday: number;
    maxToday: number;
    message: string | undefined;
}>, unknown>;
export declare const pullGacha: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    item: {
        id: string;
        name: string;
        description: string;
        rarity: string;
        type: string;
        pointsValue: number | null;
        ticketValue: number | null;
        imageUrl: string | null;
    };
}>, unknown>;
export declare const pullGachaBatch: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    items: {
        id: string;
        name: string;
        description: string;
        rarity: string;
        type: string;
        pointsValue: number | null;
        ticketValue: number | null;
        imageUrl: string | null;
    }[];
}>, unknown>;
/**
 * 管理画面ダッシュボード用の統計情報を定期的に更新
 * Scheduledで1時間ごとに実行（99%のFirestore Read削減）
 */
export declare const updateDashboardStats: functions.scheduler.ScheduleFunction;
/**
 * 管理画面ダッシュボード用の統計情報を手動更新（HTTP Callable）
 * 管理者が即座に最新データを取得したい場合に使用
 */
export declare const refreshDashboardStats: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    stats: {
        totalUsers: number;
        totalStudents: number;
        totalTeachers: number;
        totalStaff: number;
        totalAdmins: number;
        todayLogins: number;
        totalPointsIssued: number;
        activeSurveys: number;
    };
}>, unknown>;
/**
 * ランキング情報を定期的にキャッシュ
 * Scheduledで10分ごとに実行（90%のFirestore Read削減）
 */
export declare const updateRankingCache: functions.scheduler.ScheduleFunction;
/**
 * ランキング情報を手動更新（HTTP Callable）
 * ユーザーが即座に最新ランキングを確認したい場合に使用
 */
export declare const refreshRankingCache: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    personalRankingCount: number;
    classRankingCount: number;
}>, unknown>;
/**
 * 不正なadminユーザーを検出し、studentロールに降格する
 * 許可されたメールアドレス以外のadminを全てstudentに変更
 */
export declare const auditAndFixAdminRoles: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    fixed: string[];
    kept: string[];
}>, unknown>;
/**
 * 現在のadmin/staffユーザー一覧を取得（監査用）
 */
export declare const listPrivilegedUsers: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    admins: {
        id: string;
        email: any;
        username: any;
        isAllowed: boolean;
    }[];
    staff: {
        id: string;
        email: any;
        username: any;
    }[];
    allowedAdminEmails: string[];
}>, unknown>;
/**
 * 通知を開いた時にポイントを付与
 */
export declare const claimNotificationPoints: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
/**
 * Automatically increment readCount when a user marks a notification as read
 * Triggered when: notifications/{notifId}/readStatus/{userId} is created
 */
export declare const updateNotificationReadCount: functions.CloudFunction<functions.firestore.FirestoreEvent<functions.firestore.QueryDocumentSnapshot | undefined, {
    userId: string;
    notifId: string;
}>>;
/**
 * Migration function to convert readBy arrays to readStatus subcollections
 * This is a one-time migration function for existing notifications
 * Call via: firebase functions:call migrateNotificationReadStatus
 */
export declare const migrateNotificationReadStatus: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    migrated: number;
    errors: number;
    message: string;
}>, unknown>;
/**
 * Daily scheduled function to aggregate point history
 * Runs at midnight JST every day
 * Creates daily summaries in pointAggregations/{userId}/daily/{YYYY-MM-DD}
 */
export declare const aggregatePointHistory: functions.scheduler.ScheduleFunction;
/**
 * Manual trigger for point aggregation (for testing or backfill)
 * Admin-only callable function
 */
export declare const triggerPointAggregation: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    date: string;
    processedUsers: number;
    message: string;
}>, unknown>;
/**
 * Track class membership changes when a user's grade/class is updated
 * Updates memberIds array in classes collection for efficient member lookup
 */
export declare const updateClassMembers: functions.CloudFunction<functions.firestore.FirestoreEvent<functions.firestore.Change<functions.firestore.DocumentSnapshot> | undefined, {
    userId: string;
}>>;
/**
 * Initialize memberIds for all existing classes
 * One-time migration function
 */
export declare const initializeClassMembers: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    classesUpdated: number;
    totalUsers: number;
    message: string;
}>, unknown>;
export declare const bulkDistributeByClass: functions.https.CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    errors?: undefined;
} | {
    success: boolean;
    message: string;
    successCount: number;
    totalCount: number;
    errors: string[] | undefined;
}>, unknown>;
//# sourceMappingURL=index.d.ts.map