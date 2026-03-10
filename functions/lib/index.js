"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyStampCode = exports.toggleExecutiveQALike = exports.getUploadUrl = exports.bulkDistributeByClass = exports.initializeClassMembers = exports.updateClassMembers = exports.triggerPointAggregation = exports.aggregatePointHistory = exports.migrateNotificationReadStatus = exports.syncRecentPointHistory = exports.updateNotificationReadCount = exports.claimNotificationPoints = exports.listPrivilegedUsers = exports.auditAndFixAdminRoles = exports.refreshRankingCache = exports.updateRankingCache = exports.refreshDashboardStats = exports.updateDashboardStats = exports.pullGachaBatch = exports.pullGacha = exports.submitTetrisScore = exports.resetTetrisRankings = exports.registerTetrisRanking = exports.getTodayTetrisStats = exports.clearPoints = exports.deductPoints = exports.bulkDeductGachaTickets = exports.bulkGrantGachaTickets = exports.clearGachaTickets = exports.deductGachaTickets = exports.grantGachaTickets = exports.changeUsername = exports.updateUserRole = exports.submitSurveyResponse = exports.bulkDeductPoints = exports.bulkGrantPoints = exports.grantPoints = exports.updateTetrisRewardConfig = exports.updateLoginBonusConfig = exports.awardLoginBonus = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const googleapis_1 = require("googleapis");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const params_1 = require("firebase-functions/params");
admin.initializeApp();
const db = admin.firestore();
const DEFAULT_STREAK_MILESTONES = { 3: 20, 7: 50, 14: 100, 30: 300 };
const DEFAULT_TETRIS_REWARDS = {
    firstTierLimit: 10,
    firstTierMultiplier: 10,
    secondTierLimit: 100,
    secondTierMultiplier: 1,
};
const MAX_UPLOAD_SIZE_BYTES = 1024 * 1024;
// 監査ログを記録する関数（セキュリティ上重要なアクションを追跡）
async function logAdminAction(adminUid, action, details) {
    try {
        await db.collection('adminLogs').add({
            adminUid,
            action,
            details,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        // ログ記録の失敗は本来のアクションをブロックしない
        console.error('Failed to log admin action:', error);
    }
}
async function isValidDomain(email) {
    if (!email)
        return false;
    const configDoc = await db.collection('config').doc('domainRestriction').get();
    const restrictionEnabled = configDoc.exists && configDoc.data()?.enabled === true;
    if (!restrictionEnabled)
        return true;
    return email.endsWith('@g.nagano-c.ed.jp');
}
async function assertValidDomain(email) {
    if (!(await isValidDomain(email))) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
}
// クラスポイント更新のためのDocumentReference を返す（grade/class が未定義なら null）
function getClassRef(userData) {
    if (userData.grade == null || userData.class == null)
        return null;
    return db.collection('classes').doc(`${userData.grade}-${userData.class}`);
}
// クラスポイント書き込み（read は事前に済んでおくこと）
function writeClassPoints(transaction, classRef, classDoc, userData, points) {
    if (classDoc.exists) {
        transaction.update(classRef, {
            totalPoints: admin.firestore.FieldValue.increment(points),
        });
    }
    else {
        transaction.set(classRef, {
            grade: userData.grade,
            className: userData.class,
            totalPoints: points,
            memberCount: 1,
        });
    }
}
async function awardBadgesIfNeeded(userId, badgeIds) {
    const uniqueBadgeIds = [...new Set(badgeIds.filter(Boolean))];
    if (uniqueBadgeIds.length === 0)
        return [];
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists)
        return [];
    const currentBadges = (userDoc.data()?.badges || []);
    const newBadges = uniqueBadgeIds.filter((badgeId) => !currentBadges.includes(badgeId));
    if (newBadges.length > 0) {
        await userDocRef.update({
            badges: admin.firestore.FieldValue.arrayUnion(...newBadges),
        });
    }
    return newBadges;
}
async function checkAndAwardCompletionBadge(userId, category) {
    const badgeId = category === 'task' ? 'all_tasks_done' : 'all_missions_done';
    const activeSurveysSnap = await db.collection('surveys')
        .where('category', '==', category)
        .where('status', '==', 'active')
        .get();
    if (activeSurveysSnap.empty)
        return [];
    const activeSurveyIds = new Set(activeSurveysSnap.docs.map((docSnap) => docSnap.id));
    const responsesSnap = await db.collection('surveyResponses')
        .where('userId', '==', userId)
        .get();
    const answeredIds = new Set(responsesSnap.docs
        .map((docSnap) => docSnap.data().surveyId)
        .filter((surveyId) => activeSurveyIds.has(surveyId)));
    if (answeredIds.size === activeSurveyIds.size) {
        return awardBadgesIfNeeded(userId, [badgeId]);
    }
    return [];
}
async function appendToGoogleSheet(surveyTitle, userId, answers) {
    const sheetsKeyRaw = process.env.GOOGLE_SHEETS_KEY;
    let sheetId = process.env.GOOGLE_SHEET_ID || null;
    if (!sheetId) {
        try {
            const configDoc = await db.collection('config').doc('sheetSync').get();
            if (configDoc.exists)
                sheetId = configDoc.data().sheetId || null;
        }
        catch (err) {
            console.warn('Failed to read sheetSync config:', err);
        }
    }
    if (!sheetsKeyRaw || !sheetId) {
        console.warn('Google Sheets not configured, skipping sync');
        return;
    }
    const credentials = JSON.parse(sheetsKeyRaw);
    const auth = new googleapis_1.google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
    const row = [
        new Date().toISOString(),
        surveyTitle,
        userId,
        JSON.stringify(answers),
    ];
    await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
    });
}
// ユーザーネーム生成用単語リスト（クライアントと同一）
const WORD_LIST_A = [
    'エビ', '大豆', 'さといも', 'トマト', 'ほうれん草',
    'かまぼこ', 'サーモン', '牛', '鮭', '生クリーム',
    '豚', 'マヨ', 'にんじん', 'さつまいも', 'バナナ',
    'りんご', '餡', 'いか', 'マカロニ', 'ブロッコリー',
    'えのき', '鶏', 'カサゴ', 'じゃがいも', 'ねぎ',
    'もずく', '牡蠣', 'チョコ', 'ハバネロ', 'キャベツ',
];
const WORD_LIST_B = [
    'たまねぎ', 'さば', 'さといも', 'コーン', 'エリンギ',
    '卵', '豆腐', 'バター', 'たけのこ', '黒豆',
    'きくらげ', 'ピーマン', '大根', 'わかめ', 'しめじ',
    '芽キャベツ', 'かぼちゃ', 'ホタテ', 'かぶ', 'ごぼう',
    'タコ', 'のり', 'ちくわ', 'なす', 'チーズ',
    'にんにく', '白菜', 'マグロ', 'グレープ', 'ケチャップ',
];
const WORD_LIST_C = [
    '丼', 'うどん', 'の太巻き', '汁', 'バーガー',
    'スープ', 'カレー', 'カツ', 'ジャム', '寿司',
    '鍋', 'そば', 'ラーメン', '軍艦', '焼き',
    'しゃぶしゃぶ', '蒸し', 'シチュー', 'アヒージョ', 'ケーキ',
    '煮', 'ホイル焼き', 'コロネ', 'サラダ', 'プリン',
    'キムチ', '(生)', '炒め', '串', 'おにぎり',
];
// ログインボーナス付与（設定可能）
exports.awardLoginBonus = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const uid = request.auth.uid;
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    // JST で今日の日付
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = jst.toISOString().split('T')[0];
    if (userData.lastLoginDate === today) {
        return { success: false, message: '今日のログインボーナスは既に受け取っています' };
    }
    // ストリーク計算: 昨日ログインしていたら継続、それ以外はリセット
    const yesterday = new Date(jst.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const previousStreak = userData.loginStreak || 0;
    const lastStreakDate = userData.lastStreakDate || '';
    let newStreak;
    if (lastStreakDate === yesterday) {
        newStreak = previousStreak + 1;
    }
    else if (lastStreakDate === today) {
        newStreak = previousStreak; // Same day, no change
    }
    else {
        newStreak = 1; // Reset
    }
    const configDoc = await db.collection('config').doc('loginBonus').get();
    const loginBonusConfig = configDoc.exists ? configDoc.data() : {};
    const streakMilestones = (loginBonusConfig.streakMilestones || DEFAULT_STREAK_MILESTONES);
    // ストリークマイルストーンボーナス
    const streakBonus = streakMilestones[newStreak] || 0;
    // ストリークバッジ付与
    const streakBadgeMap = { 3: 'streak_3', 7: 'streak_7', 14: 'streak_14', 30: 'streak_30' };
    const newBadgeId = streakBadgeMap[newStreak] || null;
    const userBadges = userData.badges || [];
    const shouldAwardBadge = newBadgeId && !userBadges.includes(newBadgeId);
    // ログインボーナス設定を取得（デフォルト: 10pt + 1チケット）
    const bonusPoints = loginBonusConfig.points || 10;
    const bonusTickets = loginBonusConfig.tickets || 1;
    const totalPoints = bonusPoints + streakBonus;
    const classRef = getClassRef(userData);
    await db.runTransaction(async (transaction) => {
        // --- reads first ---
        const classDoc = classRef && totalPoints > 0 ? await transaction.get(classRef) : null;
        // --- writes ---
        if (totalPoints > 0) {
            const historyRef = db.collection('pointHistory').doc();
            transaction.set(historyRef, {
                userId: uid,
                points: totalPoints,
                reason: 'login_bonus',
                details: streakBonus > 0
                    ? `ログインボーナス（${today}）+ ストリーク${newStreak}日ボーナス ${streakBonus}pt`
                    : `ログインボーナス（${today}）`,
                grantedBy: 'system',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        const userUpdate = {
            totalPoints: admin.firestore.FieldValue.increment(totalPoints),
            lastLoginDate: today,
            loginStreak: newStreak,
            lastStreakDate: today,
            gachaTickets: admin.firestore.FieldValue.increment(bonusTickets),
        };
        transaction.update(userDocRef, userUpdate);
        if (classRef && classDoc && totalPoints > 0) {
            writeClassPoints(transaction, classRef, classDoc, userData, totalPoints);
        }
        if (bonusTickets > 0) {
            const ticketHistoryRef = db.collection('ticketHistory').doc();
            transaction.set(ticketHistoryRef, {
                userId: uid,
                tickets: bonusTickets,
                reason: 'admin_grant',
                details: `ログインボーナス付与チケット（${today}）`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    const extraBadges = [];
    if (shouldAwardBadge && newBadgeId) {
        extraBadges.push(newBadgeId);
    }
    const festivalDoc = await db.collection('config').doc('festivalDate').get();
    if (festivalDoc.exists) {
        const startDate = festivalDoc.data()?.startDate?.toDate?.();
        if (startDate) {
            const festivalStartJst = new Date(startDate.getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
            if (festivalStartJst === today) {
                const earlyLoginsSnap = await db.collection('users').where('lastLoginDate', '==', today).count().get();
                if (earlyLoginsSnap.data().count <= 100) {
                    extraBadges.push('early_bird');
                }
            }
        }
    }
    const awardedBadges = await awardBadgesIfNeeded(uid, extraBadges);
    return {
        success: true,
        message: 'ログインボーナスを付与しました',
        points: totalPoints,
        tickets: bonusTickets,
        streak: newStreak,
        streakBonus,
        newBadge: awardedBadges[0] || null,
    };
});
// ログインボーナス設定更新（admin用）
exports.updateLoginBonusConfig = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { points, tickets, streakMilestones } = request.data;
    if (typeof points !== 'number' || points < 0 || typeof tickets !== 'number' || tickets < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    const normalizedMilestones = Object.entries(streakMilestones || DEFAULT_STREAK_MILESTONES).reduce((acc, [key, value]) => {
        const day = Number(key);
        const bonus = Number(value);
        if (Number.isFinite(day) && day > 0 && Number.isFinite(bonus) && bonus >= 0) {
            acc[day] = bonus;
        }
        return acc;
    }, {});
    await db.collection('config').doc('loginBonus').set({
        points,
        tickets,
        streakMilestones: Object.keys(normalizedMilestones).length > 0 ? normalizedMilestones : DEFAULT_STREAK_MILESTONES,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
    });
    return { success: true, message: 'ログインボーナス設定を更新しました' };
});
exports.updateTetrisRewardConfig = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { firstTierLimit, firstTierMultiplier, secondTierLimit, secondTierMultiplier, } = request.data;
    if (!Number.isFinite(firstTierLimit) ||
        !Number.isFinite(firstTierMultiplier) ||
        !Number.isFinite(secondTierLimit) ||
        !Number.isFinite(secondTierMultiplier) ||
        firstTierLimit < 0 ||
        secondTierLimit < firstTierLimit ||
        firstTierMultiplier < 0 ||
        secondTierMultiplier < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'テトリス報酬設定が不正です');
    }
    await db.collection('config').doc('tetrisRewards').set({
        firstTierLimit,
        firstTierMultiplier,
        secondTierLimit,
        secondTierMultiplier,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
    });
    return { success: true, message: 'テトリス報酬設定を更新しました' };
});
// 管理者によるポイント付与
exports.grantPoints = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userId, points, reason, details } = request.data;
    if (!userId || typeof points !== 'number' || points <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    const classRef = getClassRef(userData);
    await db.runTransaction(async (transaction) => {
        // --- reads first ---
        const classDoc = classRef ? await transaction.get(classRef) : null;
        // --- writes ---
        const historyRef = db.collection('pointHistory').doc();
        transaction.set(historyRef, {
            userId,
            points,
            reason: reason || 'admin_grant',
            details: details || '管理者による付与',
            grantedBy: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userDocRef, {
            totalPoints: admin.firestore.FieldValue.increment(points),
        });
        if (classRef && classDoc) {
            writeClassPoints(transaction, classRef, classDoc, userData, points);
        }
    });
    // 監査ログを記録
    await logAdminAction(request.auth.uid, 'grantPoints', {
        targetUserId: userId,
        points,
        reason: reason || 'admin_grant',
        details: details || '管理者による付与',
    });
    return { success: true, message: 'ポイントを付与しました' };
});
// 一括ポイント付与（admin/staff用）
exports.bulkGrantPoints = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userIds, points, reason, details } = request.data;
    if (!Array.isArray(userIds) || userIds.length === 0 || typeof points !== 'number' || points <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    // 最大100ユーザーまで
    if (userIds.length > 100) {
        throw new functions.https.HttpsError('invalid-argument', '一度に操作できるのは100ユーザーまでです');
    }
    let successCount = 0;
    const errors = [];
    for (const userId of userIds) {
        try {
            const userDocRef = db.collection('users').doc(userId);
            const userDoc = await userDocRef.get();
            if (!userDoc.exists) {
                errors.push(`${userId}: ユーザーが見つかりません`);
                continue;
            }
            const userData = userDoc.data();
            const classRef = getClassRef(userData);
            await db.runTransaction(async (transaction) => {
                const classDoc = classRef ? await transaction.get(classRef) : null;
                const historyRef = db.collection('pointHistory').doc();
                transaction.set(historyRef, {
                    userId,
                    points,
                    reason: reason || 'admin_grant',
                    details: details || '一括付与',
                    grantedBy: request.auth.uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                transaction.update(userDocRef, {
                    totalPoints: admin.firestore.FieldValue.increment(points),
                });
                if (classRef && classDoc) {
                    writeClassPoints(transaction, classRef, classDoc, userData, points);
                }
            });
            successCount++;
        }
        catch (err) {
            errors.push(`${userId}: ${String(err)}`);
        }
    }
    return {
        success: true,
        message: `${successCount}/${userIds.length}ユーザーに付与しました`,
        successCount,
        totalCount: userIds.length,
        errors: errors.length > 0 ? errors : undefined,
    };
});
// 一括ポイント剥奪（admin/staff用）
exports.bulkDeductPoints = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userIds, points, reason, details } = request.data;
    if (!Array.isArray(userIds) || userIds.length === 0 || typeof points !== 'number' || points <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    if (userIds.length > 100) {
        throw new functions.https.HttpsError('invalid-argument', '一度に操作できるのは100ユーザーまでです');
    }
    let successCount = 0;
    let totalDeducted = 0;
    const errors = [];
    for (const userId of userIds) {
        try {
            const userDocRef = db.collection('users').doc(userId);
            const userDoc = await userDocRef.get();
            if (!userDoc.exists) {
                errors.push(`${userId}: ユーザーが見つかりません`);
                continue;
            }
            const userData = userDoc.data();
            const currentPoints = userData.totalPoints || 0;
            const actualDeduct = Math.min(points, currentPoints);
            if (actualDeduct === 0) {
                errors.push(`${userId}: ポイントが不足しています`);
                continue;
            }
            const classRef = getClassRef(userData);
            await db.runTransaction(async (transaction) => {
                const classDoc = classRef ? await transaction.get(classRef) : null;
                const historyRef = db.collection('pointHistory').doc();
                transaction.set(historyRef, {
                    userId,
                    points: -actualDeduct,
                    reason: reason || 'admin_deduct',
                    details: details || '一括剥奪',
                    grantedBy: request.auth.uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                transaction.update(userDocRef, {
                    totalPoints: admin.firestore.FieldValue.increment(-actualDeduct),
                });
                if (classRef && classDoc) {
                    writeClassPoints(transaction, classRef, classDoc, userData, -actualDeduct);
                }
            });
            successCount++;
            totalDeducted += actualDeduct;
        }
        catch (err) {
            errors.push(`${userId}: ${String(err)}`);
        }
    }
    return {
        success: true,
        message: `${successCount}/${userIds.length}ユーザーから剥奪しました`,
        successCount,
        totalCount: userIds.length,
        totalDeducted,
        errors: errors.length > 0 ? errors : undefined,
    };
});
// アンケート回答時のポイント付与
// GOOGLE_SHEETS_KEY シークレットが設定されていれば Google Sheets 同期を行う
exports.submitSurveyResponse = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const uid = request.auth.uid;
    const { surveyId, answers } = request.data;
    if (!surveyId || !Array.isArray(answers)) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    const surveyDoc = await db.collection('surveys').doc(surveyId).get();
    if (!surveyDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'アンケートが見つかりません');
    }
    const surveyData = surveyDoc.data();
    if (surveyData.status !== 'active') {
        throw new functions.https.HttpsError('failed-precondition', 'アンケートが無効です');
    }
    // 既回答チェック
    const existingResponse = await db.collection('surveyResponses')
        .where('surveyId', '==', surveyId)
        .where('userId', '==', uid)
        .get();
    if (!existingResponse.empty) {
        throw new functions.https.HttpsError('already-exists', '既に回答済みです');
    }
    const pointsAwarded = surveyData.points || 0;
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    const classRef = getClassRef(userData);
    await db.runTransaction(async (transaction) => {
        // --- reads first ---
        const classDoc = (classRef && pointsAwarded > 0) ? await transaction.get(classRef) : null;
        // --- writes ---
        const responseRef = db.collection('surveyResponses').doc();
        transaction.set(responseRef, {
            surveyId,
            userId: uid,
            answers,
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            pointsAwarded,
        });
        // Update user's answered survey IDs (regardless of points)
        transaction.update(userDocRef, {
            answeredSurveyIds: admin.firestore.FieldValue.arrayUnion(surveyId),
        });
        if (pointsAwarded > 0) {
            const historyRef = db.collection('pointHistory').doc();
            transaction.set(historyRef, {
                userId: uid,
                points: pointsAwarded,
                reason: 'survey',
                details: `アンケート「${surveyData.title}」完答`,
                grantedBy: 'system',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            transaction.update(userDocRef, {
                totalPoints: admin.firestore.FieldValue.increment(pointsAwarded),
            });
            if (classRef && classDoc) {
                writeClassPoints(transaction, classRef, classDoc, userData, pointsAwarded);
            }
        }
    });
    // Google Sheets 自動同期（fire-and-forget）
    appendToGoogleSheet(surveyData.title, uid, answers).catch((err) => {
        console.error('Sheets sync failed (non-critical):', err);
    });
    if (surveyData.category === 'task' || surveyData.category === 'mission') {
        await checkAndAwardCompletionBadge(uid, surveyData.category);
    }
    return { success: true, pointsAwarded, message: 'アンケートに回答しました' };
});
// adminロールを付与できるメールアドレス（ホワイトリスト）
const ADMIN_ALLOWED_EMAILS = ['ebi.sandwich.finland@gmail.com'];
// ロール変更（admin用）
exports.updateUserRole = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userId, role } = request.data;
    const validRoles = ['student', 'teacher', 'staff', 'admin'];
    if (!userId || !validRoles.includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    // 変更前のロールを取得
    const targetUserDoc = await db.collection('users').doc(userId).get();
    if (!targetUserDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const targetEmail = targetUserDoc.data().email;
    const previousRole = targetUserDoc.data().role;
    // 保護されたadminアカウントのrole変更を完全に禁止
    // （昇格も降格も不可）
    if (ADMIN_ALLOWED_EMAILS.includes(targetEmail)) {
        // 自分自身の変更も禁止（誤操作防止）
        throw new functions.https.HttpsError('permission-denied', 'このアカウントのロールは変更できません（保護されたアカウント）');
    }
    // 一般ユーザーをadminに昇格させる場合もブロック
    if (role === 'admin') {
        throw new functions.https.HttpsError('permission-denied', '新規にadminロールを付与することはできません');
    }
    await db.collection('users').doc(userId).update({ role });
    // 監査ログを記録（セキュリティ上重要なアクション）
    await logAdminAction(request.auth.uid, 'updateUserRole', {
        targetUserId: userId,
        previousRole,
        newRole: role,
    });
    return { success: true, message: 'ロールを更新しました' };
});
// ユーザーネーム変更（単語リスト縛り）
const MAX_USERNAME_CHANGES = 3;
exports.changeUsername = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const uid = request.auth.uid;
    const { word1, word2, word3 } = request.data;
    // 単語リストバリデーション
    if (!word1 || !WORD_LIST_A.includes(word1)) {
        throw new functions.https.HttpsError('invalid-argument', '食材1が無効です');
    }
    if (!word2 || !WORD_LIST_B.includes(word2)) {
        throw new functions.https.HttpsError('invalid-argument', '食材2が無効です');
    }
    if (!word3 || !WORD_LIST_C.includes(word3)) {
        throw new functions.https.HttpsError('invalid-argument', '料理が無効です');
    }
    const newUsername = `${word1}${word2}${word3}`;
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    const changeCount = userData.usernameChangeCount || 0;
    if (changeCount >= MAX_USERNAME_CHANGES) {
        throw new functions.https.HttpsError('failed-precondition', 'ユーザーネーム変更の回数上限に達しています');
    }
    // 重複チェック
    const duplicateCheck = await db.collection('users')
        .where('username', '==', newUsername)
        .get();
    if (!duplicateCheck.empty) {
        throw new functions.https.HttpsError('already-exists', 'そのユーザーネームは既に使用されています。別の組み合わせを選んでください');
    }
    await db.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(userDocRef);
        if (!freshDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
        }
        const freshCount = freshDoc.data().usernameChangeCount || 0;
        if (freshCount >= MAX_USERNAME_CHANGES) {
            throw new functions.https.HttpsError('failed-precondition', 'ユーザーネーム変更の回数上限に達しています');
        }
        transaction.update(userDocRef, {
            username: newUsername,
            usernameChangeCount: freshCount + 1,
        });
    });
    return { success: true, message: 'ユーザーネームを変更しました', remainingChanges: MAX_USERNAME_CHANGES - (changeCount + 1) };
});
// ガチャチケット配布（admin用）— userId か学生情報で対象検索
exports.grantGachaTickets = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userId, grade, classNum, studentNumber, tickets, details } = request.data;
    if (typeof tickets !== 'number' || tickets <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'チケット枚数が不正です');
    }
    // ユーザーID解決
    let resolvedUserId;
    let resolvedUsername;
    if (userId) {
        // 直接UID指定
        resolvedUserId = userId;
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
        }
        resolvedUsername = userDoc.data().username;
    }
    else if (grade != null && classNum && studentNumber != null) {
        // 学年・組・名簿番号で検索
        const searchSnap = await db.collection('users')
            .where('grade', '==', grade)
            .where('class', '==', classNum)
            .where('studentNumber', '==', studentNumber)
            .get();
        if (searchSnap.empty) {
            throw new functions.https.HttpsError('not-found', '該当の学生が見つかりません');
        }
        resolvedUserId = searchSnap.docs[0].id;
        resolvedUsername = searchSnap.docs[0].data().username;
    }
    else {
        throw new functions.https.HttpsError('invalid-argument', 'ユーザーIDか学年・組・名簿番号を指定してください');
    }
    await db.runTransaction(async (transaction) => {
        const userDocRef = db.collection('users').doc(resolvedUserId);
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
        }
        transaction.update(userDocRef, {
            gachaTickets: admin.firestore.FieldValue.increment(tickets),
        });
        const historyRef = db.collection('ticketHistory').doc();
        transaction.set(historyRef, {
            userId: resolvedUserId,
            tickets,
            reason: 'admin_grant',
            details: details || '管理者によるチケット付与',
            grantedBy: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    return { success: true, message: `${resolvedUsername}さんに${tickets}枚のチケットを付与しました` };
});
// チケット剥奪（admin/staff用）
exports.deductGachaTickets = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userId, tickets, details } = request.data;
    if (!userId || typeof tickets !== 'number' || tickets <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    const currentTickets = userData.gachaTickets || 0;
    const actualDeduct = Math.min(tickets, currentTickets);
    if (actualDeduct === 0) {
        return { success: false, message: 'チケットが足りません', actualDeducted: 0 };
    }
    await db.runTransaction(async (transaction) => {
        const historyRef = db.collection('ticketHistory').doc();
        transaction.set(historyRef, {
            userId,
            tickets: -actualDeduct,
            reason: 'admin_deduct',
            details: details || '管理者による剥奪',
            grantedBy: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userDocRef, {
            gachaTickets: admin.firestore.FieldValue.increment(-actualDeduct),
        });
    });
    return { success: true, message: `${actualDeduct}枚を剥奪しました`, actualDeducted: actualDeduct };
});
// チケットクリア（admin用）
exports.clearGachaTickets = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userId } = request.data;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    const currentTickets = userData.gachaTickets || 0;
    if (currentTickets === 0) {
        return { success: true, message: 'チケットは既に0です', clearedAmount: 0 };
    }
    await db.runTransaction(async (transaction) => {
        const historyRef = db.collection('ticketHistory').doc();
        transaction.set(historyRef, {
            userId,
            tickets: -currentTickets,
            reason: 'admin_clear',
            details: 'チケットクリア（全リセット）',
            grantedBy: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userDocRef, {
            gachaTickets: 0,
        });
    });
    return { success: true, message: `${currentTickets}枚をクリアしました`, clearedAmount: currentTickets };
});
// 一括チケット付与（admin/staff用）
exports.bulkGrantGachaTickets = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userIds, tickets, details } = request.data;
    if (!Array.isArray(userIds) || userIds.length === 0 || typeof tickets !== 'number' || tickets <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    if (userIds.length > 100) {
        throw new functions.https.HttpsError('invalid-argument', '一度に操作できるのは100ユーザーまでです');
    }
    let successCount = 0;
    const errors = [];
    for (const userId of userIds) {
        try {
            const userDocRef = db.collection('users').doc(userId);
            const userDoc = await userDocRef.get();
            if (!userDoc.exists) {
                errors.push(`${userId}: ユーザーが見つかりません`);
                continue;
            }
            await db.runTransaction(async (transaction) => {
                const historyRef = db.collection('ticketHistory').doc();
                transaction.set(historyRef, {
                    userId,
                    tickets,
                    reason: 'admin_grant',
                    details: details || '一括付与',
                    grantedBy: request.auth.uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                transaction.update(userDocRef, {
                    gachaTickets: admin.firestore.FieldValue.increment(tickets),
                });
            });
            successCount++;
        }
        catch (err) {
            errors.push(`${userId}: ${String(err)}`);
        }
    }
    return {
        success: true,
        message: `${successCount}/${userIds.length}ユーザーに付与しました`,
        successCount,
        totalCount: userIds.length,
        errors: errors.length > 0 ? errors : undefined,
    };
});
// 一括チケット剥奪（admin/staff用）
exports.bulkDeductGachaTickets = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userIds, tickets, details } = request.data;
    if (!Array.isArray(userIds) || userIds.length === 0 || typeof tickets !== 'number' || tickets <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    if (userIds.length > 100) {
        throw new functions.https.HttpsError('invalid-argument', '一度に操作できるのは100ユーザーまでです');
    }
    let successCount = 0;
    let totalDeducted = 0;
    const errors = [];
    for (const userId of userIds) {
        try {
            const userDocRef = db.collection('users').doc(userId);
            const userDoc = await userDocRef.get();
            if (!userDoc.exists) {
                errors.push(`${userId}: ユーザーが見つかりません`);
                continue;
            }
            const userData = userDoc.data();
            const currentTickets = userData.gachaTickets || 0;
            const actualDeduct = Math.min(tickets, currentTickets);
            if (actualDeduct === 0) {
                errors.push(`${userId}: チケットが不足しています`);
                continue;
            }
            await db.runTransaction(async (transaction) => {
                const historyRef = db.collection('ticketHistory').doc();
                transaction.set(historyRef, {
                    userId,
                    tickets: -actualDeduct,
                    reason: 'admin_deduct',
                    details: details || '一括剥奪',
                    grantedBy: request.auth.uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                transaction.update(userDocRef, {
                    gachaTickets: admin.firestore.FieldValue.increment(-actualDeduct),
                });
            });
            successCount++;
            totalDeducted += actualDeduct;
        }
        catch (err) {
            errors.push(`${userId}: ${String(err)}`);
        }
    }
    return {
        success: true,
        message: `${successCount}/${userIds.length}ユーザーから剥奪しました`,
        successCount,
        totalCount: userIds.length,
        totalDeducted,
        errors: errors.length > 0 ? errors : undefined,
    };
});
// 管理者によるポイント剥奪
exports.deductPoints = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userId, points, reason, details } = request.data;
    if (!userId || typeof points !== 'number' || points <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    const currentPoints = userData.totalPoints || 0;
    const actualDeduct = Math.min(points, currentPoints);
    if (actualDeduct === 0) {
        return { success: false, message: 'ポイントが足りません', actualDeducted: 0 };
    }
    const classRef = getClassRef(userData);
    await db.runTransaction(async (transaction) => {
        const classDoc = classRef ? await transaction.get(classRef) : null;
        const historyRef = db.collection('pointHistory').doc();
        transaction.set(historyRef, {
            userId,
            points: -actualDeduct,
            reason: reason || 'admin_deduct',
            details: details || '管理者による剥奪',
            grantedBy: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userDocRef, {
            totalPoints: admin.firestore.FieldValue.increment(-actualDeduct),
        });
        if (classRef && classDoc) {
            writeClassPoints(transaction, classRef, classDoc, userData, -actualDeduct);
        }
    });
    return { success: true, message: `${actualDeduct}ptを剥奪しました`, actualDeducted: actualDeduct };
});
// 管理者によるポイントクリア
exports.clearPoints = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userId } = request.data;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    const currentPoints = userData.totalPoints || 0;
    if (currentPoints === 0) {
        return { success: true, message: 'ポイントは既に0です', clearedAmount: 0 };
    }
    const classRef = getClassRef(userData);
    await db.runTransaction(async (transaction) => {
        const classDoc = classRef ? await transaction.get(classRef) : null;
        const historyRef = db.collection('pointHistory').doc();
        transaction.set(historyRef, {
            userId,
            points: -currentPoints,
            reason: 'admin_clear',
            details: 'ポイントクリア（全リセット）',
            grantedBy: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(userDocRef, {
            totalPoints: 0,
        });
        if (classRef && classDoc) {
            writeClassPoints(transaction, classRef, classDoc, userData, -currentPoints);
        }
    });
    return { success: true, message: `${currentPoints}ptをクリアしました`, clearedAmount: currentPoints };
});
// 今日のテトリス統計を取得
exports.getTodayTetrisStats = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const uid = request.auth.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    if (userData.role !== 'student') {
        return { totalToday: 0, maxToday: 100 };
    }
    // JST で今日の日付
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = jst.toISOString().split('T')[0];
    // 今日の累計列数を取得
    const tetrisStatsRef = db.collection('tetrisStats').doc(uid);
    const tetrisStatsDoc = await tetrisStatsRef.get();
    let currentTotal = 0;
    if (tetrisStatsDoc.exists) {
        const statsData = tetrisStatsDoc.data();
        if (statsData.date === today) {
            currentTotal = statsData.totalLinesCleared || 0;
        }
    }
    return { totalToday: currentTotal, maxToday: 100 };
});
// テトリスランキングに記録を登録
exports.registerTetrisRanking = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const uid = request.auth.uid;
    const { score, linesCleared } = request.data;
    if (typeof score !== 'number' || score < 0 || typeof linesCleared !== 'number' || linesCleared < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    const tetrisScoreRef = db.collection('tetrisScores').doc(uid);
    await db.runTransaction(async (transaction) => {
        const tetrisScoreDoc = await transaction.get(tetrisScoreRef);
        const existingData = tetrisScoreDoc.exists ? tetrisScoreDoc.data() : null;
        const currentHighScore = existingData?.highScore || 0;
        const currentMaxLines = existingData?.maxLines || 0;
        const currentTotalGames = existingData?.totalGames || 0;
        transaction.set(tetrisScoreRef, {
            userId: uid,
            username: userData.username,
            profileImageUrl: userData.profileImageUrl || null,
            grade: userData.grade,
            class: userData.class,
            highScore: Math.max(currentHighScore, score),
            maxLines: Math.max(currentMaxLines, linesCleared),
            totalGames: currentTotalGames + 1,
            lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    return { success: true, message: 'ランキングに登録しました' };
});
// テトリスランキングをリセット（管理者のみ）
exports.resetTetrisRankings = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const uid = request.auth.uid;
    const adminDoc = await db.collection('users').doc(uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者権限が必要です');
    }
    try {
        // tetrisScoresコレクション全体を取得
        const snapshot = await db.collection('tetrisScores').get();
        if (snapshot.empty) {
            return { success: true, message: 'リセットするランキングがありません', deletedCount: 0 };
        }
        // バッチ削除（Firestoreのバッチサイズ制限は500）
        const batchSize = 500;
        const batches = [];
        let batch = db.batch();
        let count = 0;
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
            if (count % batchSize === 0) {
                batches.push(batch.commit());
                batch = db.batch();
            }
        });
        // 残りのバッチをコミット
        if (count % batchSize !== 0) {
            batches.push(batch.commit());
        }
        await Promise.all(batches);
        // 監査ログ
        await logAdminAction(uid, 'resetTetrisRankings', { deletedCount: snapshot.size });
        return { success: true, message: `${snapshot.size}件のランキングをリセットしました`, deletedCount: snapshot.size };
    }
    catch (error) {
        console.error('Error resetting tetris rankings:', error);
        throw new functions.https.HttpsError('internal', 'ランキングのリセットに失敗しました');
    }
});
// テトリススコア提出（生徒のみ）— 日別カウント制
exports.submitTetrisScore = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const uid = request.auth.uid;
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    if (userData.role !== 'student') {
        return { success: true, pointsAwarded: 0, totalToday: 0, maxToday: 100 };
    }
    const { linesCleared, score } = request.data;
    if (typeof linesCleared !== 'number' || linesCleared < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    if (score !== undefined && (typeof score !== 'number' || score < 0)) {
        throw new functions.https.HttpsError('invalid-argument', 'スコアが不正です');
    }
    // JST で今日の日付
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = jst.toISOString().split('T')[0];
    // 今日の累計列数を取得
    const tetrisStatsRef = db.collection('tetrisStats').doc(uid);
    const tetrisStatsDoc = await tetrisStatsRef.get();
    let currentTotal = 0;
    if (tetrisStatsDoc.exists) {
        const statsData = tetrisStatsDoc.data();
        if (statsData.date === today) {
            currentTotal = statsData.totalLinesCleared || 0;
        }
    }
    // 新しい累計
    const newTotal = currentTotal + linesCleared;
    const tetrisRewardDoc = await db.collection('config').doc('tetrisRewards').get();
    const tetrisRewardConfig = tetrisRewardDoc.exists
        ? { ...DEFAULT_TETRIS_REWARDS, ...tetrisRewardDoc.data() }
        : DEFAULT_TETRIS_REWARDS;
    const firstTierLimit = Number(tetrisRewardConfig.firstTierLimit);
    const firstTierMultiplier = Number(tetrisRewardConfig.firstTierMultiplier);
    const secondTierLimit = Number(tetrisRewardConfig.secondTierLimit);
    const secondTierMultiplier = Number(tetrisRewardConfig.secondTierMultiplier);
    // ポイント計算ロジック：
    // 1~firstTierLimit列: 列数×firstTierMultiplierpt、(firstTierLimit+1)~secondTierLimit列: 列数×secondTierMultiplierpt、以降: ポイントなし
    let pointsAwarded = 0;
    if (currentTotal >= secondTierLimit) {
        pointsAwarded = 0;
    }
    else if (newTotal <= firstTierLimit) {
        pointsAwarded = linesCleared * firstTierMultiplier;
    }
    else if (currentTotal < firstTierLimit && newTotal > firstTierLimit) {
        const pointsUpToFirstTier = (firstTierLimit - currentTotal) * firstTierMultiplier;
        const linesAfterFirstTier = Math.min(newTotal - firstTierLimit, secondTierLimit - firstTierLimit);
        const pointsAfterFirstTier = linesAfterFirstTier * secondTierMultiplier;
        pointsAwarded = pointsUpToFirstTier + pointsAfterFirstTier;
    }
    else if (currentTotal >= firstTierLimit && newTotal <= secondTierLimit) {
        pointsAwarded = linesCleared * secondTierMultiplier;
    }
    else if (currentTotal < secondTierLimit && newTotal > secondTierLimit) {
        const linesUpToSecondTier = secondTierLimit - currentTotal;
        pointsAwarded = linesUpToSecondTier * secondTierMultiplier;
    }
    else {
        pointsAwarded = 0;
    }
    const classRef = getClassRef(userData);
    await db.runTransaction(async (transaction) => {
        // --- reads first ---
        const classDoc = classRef && pointsAwarded > 0 ? await transaction.get(classRef) : null;
        // --- writes ---
        // tetrisStats を更新
        transaction.set(tetrisStatsRef, {
            date: today,
            totalLinesCleared: newTotal,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        if (pointsAwarded > 0) {
            transaction.update(userDocRef, {
                totalPoints: admin.firestore.FieldValue.increment(pointsAwarded),
            });
            const historyRef = db.collection('pointHistory').doc();
            transaction.set(historyRef, {
                userId: uid,
                points: pointsAwarded,
                reason: 'game_result',
                details: `テトリス（${linesCleared}列消し / 本日累計${newTotal}列）`,
                grantedBy: 'system',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (classRef && classDoc) {
                writeClassPoints(transaction, classRef, classDoc, userData, pointsAwarded);
            }
        }
    });
    const tetrisBadges = [];
    if (typeof score === 'number' && score >= 1000)
        tetrisBadges.push('tetris_1000');
    if (typeof score === 'number' && score >= 5000)
        tetrisBadges.push('tetris_5000');
    if (tetrisBadges.length > 0) {
        await awardBadgesIfNeeded(uid, tetrisBadges);
    }
    return {
        success: true,
        pointsAwarded,
        totalToday: newTotal,
        maxToday: secondTierLimit,
        message: newTotal > secondTierLimit ? `本日の上限（${secondTierLimit}列）に達しました` : undefined
    };
});
// ガチャを引く
exports.pullGacha = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const uid = request.auth.uid;
    const userDocRef = db.collection('users').doc(uid);
    // アクティブアイテム取得
    const itemsSnap = await db.collection('gachaItems').where('isActive', '==', true).get();
    if (itemsSnap.empty) {
        throw new functions.https.HttpsError('failed-precondition', 'ガチャアイテムが設定されていません');
    }
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * totalWeight;
    let selected = items[0];
    for (const item of items) {
        rand -= item.weight;
        if (rand <= 0) {
            selected = item;
            break;
        }
    }
    await db.runTransaction(async (transaction) => {
        // --- reads first ---
        const freshUserDoc = await transaction.get(userDocRef);
        if (!freshUserDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
        }
        const currentTickets = freshUserDoc.data().gachaTickets || 0;
        if (currentTickets < 1) {
            throw new functions.https.HttpsError('failed-precondition', 'チケットが足りません');
        }
        const userData = freshUserDoc.data();
        const classRef = getClassRef(userData);
        const classDoc = (classRef && selected.type === 'points' && selected.pointsValue && selected.pointsValue > 0)
            ? await transaction.get(classRef)
            : null;
        // --- writes ---
        transaction.update(userDocRef, {
            gachaTickets: admin.firestore.FieldValue.increment(-1),
        });
        const ticketHistoryRef = db.collection('ticketHistory').doc();
        transaction.set(ticketHistoryRef, {
            userId: uid,
            tickets: -1,
            reason: 'gacha_pull',
            details: `ガチャを引いた（${selected.name}）`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const gachaHistoryRef = db.collection('gachaHistory').doc();
        transaction.set(gachaHistoryRef, {
            userId: uid,
            itemId: selected.id,
            itemName: selected.name,
            itemRarity: selected.rarity,
            pulledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        if (selected.type === 'points' && selected.pointsValue && selected.pointsValue > 0) {
            const pointsVal = selected.pointsValue;
            transaction.update(userDocRef, {
                totalPoints: admin.firestore.FieldValue.increment(pointsVal),
            });
            const pointHistoryRef = db.collection('pointHistory').doc();
            transaction.set(pointHistoryRef, {
                userId: uid,
                points: pointsVal,
                reason: 'game_result',
                details: `ガチャ「${selected.name}」からポイント獲得`,
                grantedBy: 'system',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (classRef && classDoc) {
                writeClassPoints(transaction, classRef, classDoc, userData, pointsVal);
            }
        }
        if (selected.type === 'ticket' && selected.ticketValue && selected.ticketValue > 0) {
            const ticketVal = selected.ticketValue;
            transaction.update(userDocRef, {
                gachaTickets: admin.firestore.FieldValue.increment(ticketVal),
            });
            const bonusTicketHistoryRef = db.collection('ticketHistory').doc();
            transaction.set(bonusTicketHistoryRef, {
                userId: uid,
                tickets: ticketVal,
                reason: 'gacha_item_reward',
                details: `ガチャ「${selected.name}」からチケット獲得`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    const gachaBadges = ['first_gacha'];
    if (selected.rarity === 'legendary') {
        gachaBadges.push('gacha_legendary');
    }
    const [allItemsSnap, historySnap] = await Promise.all([
        db.collection('gachaItems').where('isActive', '==', true).get(),
        db.collection('gachaHistory').where('userId', '==', uid).get(),
    ]);
    const totalItemCount = allItemsSnap.size;
    const obtainedCount = new Set(historySnap.docs.map((docSnap) => docSnap.data().itemId)).size;
    const completionRate = totalItemCount > 0 ? obtainedCount / totalItemCount : 0;
    if (completionRate >= 0.5)
        gachaBadges.push('gacha_collector_50');
    if (completionRate >= 1)
        gachaBadges.push('gacha_collector_100');
    await awardBadgesIfNeeded(uid, gachaBadges);
    return {
        success: true,
        item: {
            id: selected.id,
            name: selected.name,
            description: selected.description || '',
            rarity: selected.rarity,
            type: selected.type,
            pointsValue: selected.pointsValue ?? null,
            ticketValue: selected.ticketValue ?? null,
            imageUrl: selected.imageUrl || null,
        },
    };
});
// ガチャを複数回引く（バッチ処理で高速化）
exports.pullGachaBatch = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const count = request.data?.count ?? 1;
    if (count < 1 || count > 10) {
        throw new functions.https.HttpsError('invalid-argument', '1〜10回の範囲で指定してください');
    }
    const uid = request.auth.uid;
    const userDocRef = db.collection('users').doc(uid);
    // アクティブアイテム取得（1回だけ）
    const itemsSnap = await db.collection('gachaItems').where('isActive', '==', true).get();
    if (itemsSnap.empty) {
        throw new functions.https.HttpsError('failed-precondition', 'ガチャアイテムが設定されていません');
    }
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    // 重み付きランダム選択を複数回実行
    const selectedItems = [];
    for (let i = 0; i < count; i++) {
        let rand = Math.random() * totalWeight;
        let selected = items[0];
        for (const item of items) {
            rand -= item.weight;
            if (rand <= 0) {
                selected = item;
                break;
            }
        }
        selectedItems.push(selected);
    }
    // 集計
    let totalPointsGain = 0;
    let totalTicketsGain = 0;
    for (const item of selectedItems) {
        if (item.type === 'points' && item.pointsValue) {
            totalPointsGain += item.pointsValue;
        }
        if (item.type === 'ticket' && item.ticketValue) {
            totalTicketsGain += item.ticketValue;
        }
    }
    await db.runTransaction(async (transaction) => {
        // --- reads first ---
        const freshUserDoc = await transaction.get(userDocRef);
        if (!freshUserDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
        }
        const currentTickets = freshUserDoc.data().gachaTickets || 0;
        if (currentTickets < count) {
            throw new functions.https.HttpsError('failed-precondition', 'チケットが足りません');
        }
        const userData = freshUserDoc.data();
        const classRef = getClassRef(userData);
        const classDoc = (classRef && totalPointsGain > 0)
            ? await transaction.get(classRef)
            : null;
        // --- writes ---
        // チケット消費
        transaction.update(userDocRef, {
            gachaTickets: admin.firestore.FieldValue.increment(-count),
            ...(totalPointsGain > 0 && { totalPoints: admin.firestore.FieldValue.increment(totalPointsGain) }),
            ...(totalTicketsGain > 0 && { gachaTickets: admin.firestore.FieldValue.increment(totalTicketsGain - count) }),
        });
        // チケット消費履歴
        const ticketHistoryRef = db.collection('ticketHistory').doc();
        transaction.set(ticketHistoryRef, {
            userId: uid,
            tickets: -count,
            reason: 'gacha_pull',
            details: `ガチャ${count}連を引いた`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 各アイテムの履歴を記録
        for (const item of selectedItems) {
            const gachaHistoryRef = db.collection('gachaHistory').doc();
            transaction.set(gachaHistoryRef, {
                userId: uid,
                itemId: item.id,
                itemName: item.name,
                itemRarity: item.rarity,
                pulledAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // ポイント獲得履歴（まとめて1件）
        if (totalPointsGain > 0) {
            const pointHistoryRef = db.collection('pointHistory').doc();
            transaction.set(pointHistoryRef, {
                userId: uid,
                points: totalPointsGain,
                reason: 'game_result',
                details: `ガチャ${count}連からポイント獲得`,
                grantedBy: 'system',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (classRef && classDoc) {
                writeClassPoints(transaction, classRef, classDoc, userData, totalPointsGain);
            }
        }
        // チケット獲得履歴（まとめて1件）
        if (totalTicketsGain > 0) {
            const bonusTicketHistoryRef = db.collection('ticketHistory').doc();
            transaction.set(bonusTicketHistoryRef, {
                userId: uid,
                tickets: totalTicketsGain,
                reason: 'gacha_item_reward',
                details: `ガチャ${count}連からチケット獲得`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    const gachaBadges = ['first_gacha'];
    if (selectedItems.some((item) => item.rarity === 'legendary')) {
        gachaBadges.push('gacha_legendary');
    }
    const [allItemsSnap, historySnap] = await Promise.all([
        db.collection('gachaItems').where('isActive', '==', true).get(),
        db.collection('gachaHistory').where('userId', '==', uid).get(),
    ]);
    const totalItemCount = allItemsSnap.size;
    const obtainedCount = new Set(historySnap.docs.map((docSnap) => docSnap.data().itemId)).size;
    const completionRate = totalItemCount > 0 ? obtainedCount / totalItemCount : 0;
    if (completionRate >= 0.5)
        gachaBadges.push('gacha_collector_50');
    if (completionRate >= 1)
        gachaBadges.push('gacha_collector_100');
    await awardBadgesIfNeeded(uid, gachaBadges);
    return {
        success: true,
        items: selectedItems.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description || '',
            rarity: item.rarity,
            type: item.type,
            pointsValue: item.pointsValue ?? null,
            ticketValue: item.ticketValue ?? null,
            imageUrl: item.imageUrl || null,
        })),
    };
});
// ==========================================
// Dashboard Stats Cache - Admin Dashboard Optimization
// ==========================================
/**
 * 管理画面ダッシュボード用の統計情報を定期的に更新
 * Scheduledで1時間ごとに実行（99%のFirestore Read削減）
 */
exports.updateDashboardStats = functions.scheduler.onSchedule({
    schedule: 'every 1 hours',
    timeZone: 'Asia/Tokyo',
    memory: '256MiB',
}, async () => {
    try {
        // 全ユーザー数を取得
        const usersSnapshot = await db.collection('users').count().get();
        const totalUsers = usersSnapshot.data().count;
        // ロール別ユーザー数を集計
        const studentsSnapshot = await db.collection('users').where('role', '==', 'student').count().get();
        const teachersSnapshot = await db.collection('users').where('role', '==', 'teacher').count().get();
        const staffSnapshot = await db.collection('users').where('role', '==', 'staff').count().get();
        const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').count().get();
        const totalStudents = studentsSnapshot.data().count;
        const totalTeachers = teachersSnapshot.data().count;
        const totalStaff = staffSnapshot.data().count;
        const totalAdmins = adminsSnapshot.data().count;
        // 今日のログインユーザー数（近似）
        const today = new Date().toISOString().split('T')[0];
        const todayLoginsSnapshot = await db.collection('users')
            .where('lastLoginDate', '==', today)
            .count()
            .get();
        const todayLogins = todayLoginsSnapshot.data().count;
        // 総ポイント発行数 - 集計クエリで効率化（N件 = ceil(N/1000) reads）
        const pointsAggregateSnapshot = await db.collection('pointHistory')
            .where('points', '>', 0)
            .aggregate({
            totalPointsIssued: admin.firestore.AggregateField.sum('points'),
        })
            .get();
        const totalPointsIssued = pointsAggregateSnapshot.data().totalPointsIssued || 0;
        // アクティブなアンケート数
        const activeSurveysSnapshot = await db.collection('surveys')
            .where('status', '==', 'active')
            .count()
            .get();
        const activeSurveys = activeSurveysSnapshot.data().count;
        // 統計情報をFirestoreに保存
        const statsRef = db.collection('config').doc('dashboardStats');
        await statsRef.set({
            totalUsers,
            totalStudents,
            totalTeachers,
            totalStaff,
            totalAdmins,
            todayLogins,
            totalPointsIssued,
            activeSurveys,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('Dashboard stats updated successfully');
    }
    catch (error) {
        console.error('Error updating dashboard stats:', error);
        throw error;
    }
});
/**
 * 管理画面ダッシュボード用の統計情報を手動更新（HTTP Callable）
 * 管理者が即座に最新データを取得したい場合に使用
 */
exports.refreshDashboardStats = functions.https.onCall(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です');
    }
    // 管理者権限チェック
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData || (userData.role !== 'admin' && userData.role !== 'staff')) {
        throw new functions.https.HttpsError('permission-denied', '管理者権限が必要です');
    }
    try {
        // updateDashboardStatsと同じロジックを実行
        const usersSnapshot = await db.collection('users').count().get();
        const totalUsers = usersSnapshot.data().count;
        const studentsSnapshot = await db.collection('users').where('role', '==', 'student').count().get();
        const teachersSnapshot = await db.collection('users').where('role', '==', 'teacher').count().get();
        const staffSnapshot = await db.collection('users').where('role', '==', 'staff').count().get();
        const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').count().get();
        const totalStudents = studentsSnapshot.data().count;
        const totalTeachers = teachersSnapshot.data().count;
        const totalStaff = staffSnapshot.data().count;
        const totalAdmins = adminsSnapshot.data().count;
        const today = new Date().toISOString().split('T')[0];
        const todayLoginsSnapshot = await db.collection('users')
            .where('lastLoginDate', '==', today)
            .count()
            .get();
        const todayLogins = todayLoginsSnapshot.data().count;
        // 総ポイント発行数 - 集計クエリで効率化（N件 = ceil(N/1000) reads）
        const pointsAggregateSnapshot = await db.collection('pointHistory')
            .where('points', '>', 0)
            .aggregate({
            totalPointsIssued: admin.firestore.AggregateField.sum('points'),
        })
            .get();
        const totalPointsIssued = pointsAggregateSnapshot.data().totalPointsIssued || 0;
        const activeSurveysSnapshot = await db.collection('surveys')
            .where('status', '==', 'active')
            .count()
            .get();
        const activeSurveys = activeSurveysSnapshot.data().count;
        const statsRef = db.collection('config').doc('dashboardStats');
        await statsRef.set({
            totalUsers,
            totalStudents,
            totalTeachers,
            totalStaff,
            totalAdmins,
            todayLogins,
            totalPointsIssued,
            activeSurveys,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            success: true,
            stats: {
                totalUsers,
                totalStudents,
                totalTeachers,
                totalStaff,
                totalAdmins,
                todayLogins,
                totalPointsIssued,
                activeSurveys,
            },
        };
    }
    catch (error) {
        console.error('Error refreshing dashboard stats:', error);
        throw new functions.https.HttpsError('internal', '統計情報の更新に失敗しました');
    }
});
// ==========================================
// Ranking Cache - RankingPage Optimization
// ==========================================
/**
 * ランキング情報を定期的にキャッシュ
 * Scheduledで10分ごとに実行（90%のFirestore Read削減）
 */
exports.updateRankingCache = functions.scheduler.onSchedule({
    schedule: 'every 10 minutes',
    timeZone: 'Asia/Tokyo',
    memory: '512MiB',
}, async () => {
    try {
        // 個人ランキング（トップ100）
        const usersSnapshot = await db.collection('users')
            .orderBy('totalPoints', 'desc')
            .limit(100)
            .get();
        const personalRanking = usersSnapshot.docs.map((doc, index) => {
            const data = doc.data();
            return {
                rank: index + 1,
                userId: doc.id,
                username: data.username || 'Unknown',
                totalPoints: data.totalPoints || 0,
                grade: data.grade || null,
                class: data.class || null,
            };
        });
        // クラスランキング（全クラス）
        const classesSnapshot = await db.collection('classes')
            .orderBy('totalPoints', 'desc')
            .get();
        const classRanking = classesSnapshot.docs.map((doc, index) => {
            const data = doc.data();
            return {
                rank: index + 1,
                classId: doc.id,
                grade: data.grade || 0,
                className: data.className || '',
                totalPoints: data.totalPoints || 0,
                memberCount: data.memberCount || 0,
            };
        });
        // キャッシュをFirestoreに保存
        const batch = db.batch();
        const personalRankingRef = db.collection('config').doc('personalRanking');
        batch.set(personalRankingRef, {
            rankings: personalRanking,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        const classRankingRef = db.collection('config').doc('classRanking');
        batch.set(classRankingRef, {
            rankings: classRanking,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();
        console.log('Ranking cache updated successfully');
    }
    catch (error) {
        console.error('Error updating ranking cache:', error);
        throw error;
    }
});
/**
 * ランキング情報を手動更新（HTTP Callable）
 * ユーザーが即座に最新ランキングを確認したい場合に使用
 */
exports.refreshRankingCache = functions.https.onCall(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です');
    }
    try {
        // 個人ランキング
        const usersSnapshot = await db.collection('users')
            .orderBy('totalPoints', 'desc')
            .limit(100)
            .get();
        const personalRanking = usersSnapshot.docs.map((doc, index) => {
            const data = doc.data();
            return {
                rank: index + 1,
                userId: doc.id,
                username: data.username || 'Unknown',
                totalPoints: data.totalPoints || 0,
                grade: data.grade || null,
                class: data.class || null,
            };
        });
        // クラスランキング
        const classesSnapshot = await db.collection('classes')
            .orderBy('totalPoints', 'desc')
            .get();
        const classRanking = classesSnapshot.docs.map((doc, index) => {
            const data = doc.data();
            return {
                rank: index + 1,
                classId: doc.id,
                grade: data.grade || 0,
                className: data.className || '',
                totalPoints: data.totalPoints || 0,
                memberCount: data.memberCount || 0,
            };
        });
        // キャッシュ保存
        const batch = db.batch();
        const personalRankingRef = db.collection('config').doc('personalRanking');
        batch.set(personalRankingRef, {
            rankings: personalRanking,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        const classRankingRef = db.collection('config').doc('classRanking');
        batch.set(classRankingRef, {
            rankings: classRanking,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();
        return {
            success: true,
            personalRankingCount: personalRanking.length,
            classRankingCount: classRanking.length,
        };
    }
    catch (error) {
        console.error('Error refreshing ranking cache:', error);
        throw new functions.https.HttpsError('internal', 'ランキング更新に失敗しました');
    }
});
// ==========================================
// Security: Admin Audit & Cleanup
// ==========================================
/**
 * 不正なadminユーザーを検出し、studentロールに降格する
 * 許可されたメールアドレス以外のadminを全てstudentに変更
 */
exports.auditAndFixAdminRoles = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const email = request.auth.token?.email || '';
    // この関数自体も許可されたメールアドレスのみ実行可能
    if (!ADMIN_ALLOWED_EMAILS.includes(email)) {
        throw new functions.https.HttpsError('permission-denied', 'この操作は許可されていません');
    }
    // 現在adminロールを持つ全ユーザーを取得
    const adminUsersSnapshot = await db.collection('users')
        .where('role', '==', 'admin')
        .get();
    const results = { fixed: [], kept: [] };
    for (const doc of adminUsersSnapshot.docs) {
        const userData = doc.data();
        const userEmail = userData.email;
        if (ADMIN_ALLOWED_EMAILS.includes(userEmail)) {
            // 許可されたadmin
            results.kept.push(userEmail);
        }
        else {
            // 不正なadmin → studentに降格
            await doc.ref.update({ role: 'student' });
            results.fixed.push(userEmail);
            // 監査ログを記録
            await logAdminAction(request.auth.uid, 'auditAndFixAdminRoles', {
                targetUserId: doc.id,
                targetEmail: userEmail,
                previousRole: 'admin',
                newRole: 'student',
                reason: 'unauthorized_admin_detected',
            });
        }
    }
    return {
        success: true,
        message: `${results.fixed.length}人の不正なadminをstudentに降格しました`,
        fixed: results.fixed,
        kept: results.kept,
    };
});
/**
 * 現在のadmin/staffユーザー一覧を取得（監査用）
 */
exports.listPrivilegedUsers = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const email = request.auth.token?.email || '';
    // 許可されたメールアドレスのみ実行可能
    if (!ADMIN_ALLOWED_EMAILS.includes(email)) {
        throw new functions.https.HttpsError('permission-denied', 'この操作は許可されていません');
    }
    const adminsSnapshot = await db.collection('users')
        .where('role', '==', 'admin')
        .get();
    const staffSnapshot = await db.collection('users')
        .where('role', '==', 'staff')
        .get();
    const admins = adminsSnapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email,
        username: doc.data().username,
        isAllowed: ADMIN_ALLOWED_EMAILS.includes(doc.data().email),
    }));
    const staff = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email,
        username: doc.data().username,
    }));
    return {
        success: true,
        admins,
        staff,
        allowedAdminEmails: ADMIN_ALLOWED_EMAILS,
    };
});
// ==========================================
// Notification Points
// ==========================================
/**
 * 通知を開いた時にポイントを付与
 */
exports.claimNotificationPoints = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const uid = request.auth.uid;
    const { notificationId } = request.data;
    if (!notificationId) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    const notifRef = db.collection('notifications').doc(notificationId);
    const userDocRef = db.collection('users').doc(uid);
    await db.runTransaction(async (transaction) => {
        // --- reads first ---
        const notifDoc = await transaction.get(notifRef);
        const userDoc = await transaction.get(userDocRef);
        if (!notifDoc.exists) {
            throw new functions.https.HttpsError('not-found', '通知が見つかりません');
        }
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
        }
        const notifData = notifDoc.data();
        const userData = userDoc.data();
        const points = notifData.points || 0;
        // ポイント付与がない場合
        if (points <= 0) {
            return;
        }
        // 既にポイントを受け取っている場合
        const pointsReceivedBy = notifData.pointsReceivedBy || [];
        if (pointsReceivedBy.includes(uid)) {
            throw new functions.https.HttpsError('already-exists', '既にポイントを受け取っています');
        }
        const classRef = getClassRef(userData);
        const classDoc = classRef ? await transaction.get(classRef) : null;
        // --- writes ---
        // ポイント履歴を記録
        const historyRef = db.collection('pointHistory').doc();
        transaction.set(historyRef, {
            userId: uid,
            points,
            reason: 'admin_grant',
            details: `通知「${notifData.title}」を確認`,
            grantedBy: 'system',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // ユーザーのポイントを更新
        transaction.update(userDocRef, {
            totalPoints: admin.firestore.FieldValue.increment(points),
        });
        // クラスポイントを更新
        if (classRef && classDoc) {
            writeClassPoints(transaction, classRef, classDoc, userData, points);
        }
        // 通知のpointsReceivedByを更新
        transaction.update(notifRef, {
            pointsReceivedBy: admin.firestore.FieldValue.arrayUnion(uid),
        });
    });
    return { success: true, message: 'ポイントを獲得しました' };
});
// ===== NOTIFICATION OPTIMIZATION (Cost Reduction) =====
/**
 * Automatically increment readCount when a user marks a notification as read
 * Triggered when: notifications/{notifId}/readStatus/{userId} is created
 */
exports.updateNotificationReadCount = functions.firestore.onDocumentCreated('notifications/{notifId}/readStatus/{userId}', async (event) => {
    const notifId = event.params.notifId;
    try {
        const notifRef = db.collection('notifications').doc(notifId);
        await notifRef.update({
            readCount: admin.firestore.FieldValue.increment(1)
        });
        console.log(`Updated readCount for notification ${notifId}`);
    }
    catch (error) {
        console.error(`Failed to update readCount for notification ${notifId}:`, error);
        // Don't throw - allow the subcollection write to succeed even if parent update fails
    }
});
exports.syncRecentPointHistory = functions.firestore.onDocumentCreated('pointHistory/{historyId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    try {
        const data = snapshot.data();
        const userId = data.userId;
        if (!userId)
            return;
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists)
            return;
        const currentRecent = (userDoc.data()?.recentPointHistory || []);
        const nextItem = {
            id: snapshot.id,
            points: data.points || 0,
            reason: data.reason || 'game_result',
            details: data.details || '',
            createdAt: data.createdAt || admin.firestore.Timestamp.now(),
        };
        const merged = [nextItem, ...currentRecent.filter((item) => item.id !== snapshot.id)]
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
            .slice(0, 10);
        await userRef.update({
            recentPointHistory: merged,
        });
    }
    catch (error) {
        console.error('Failed to sync recent point history:', error);
    }
});
/**
 * Migration function to convert readBy arrays to readStatus subcollections
 * This is a one-time migration function for existing notifications
 * Call via: firebase functions:call migrateNotificationReadStatus
 */
exports.migrateNotificationReadStatus = functions.https.onCall(async (request) => {
    // Verify admin permissions
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者権限が必要です');
    }
    console.log(`Starting notification migration by admin ${request.auth.uid}`);
    const notificationsSnap = await db.collection('notifications').get();
    let migratedCount = 0;
    let errorCount = 0;
    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    let batch = db.batch();
    let operationCount = 0;
    for (const notifDoc of notificationsSnap.docs) {
        try {
            const data = notifDoc.data();
            const readBy = data.readBy || [];
            // Create readStatus subcollection entries
            for (const userId of readBy) {
                const readStatusRef = notifDoc.ref
                    .collection('readStatus')
                    .doc(userId);
                batch.set(readStatusRef, {
                    readAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                    pointsClaimed: data.pointsReceivedBy?.includes(userId) || false
                });
                operationCount++;
                // Commit batch if limit reached
                if (operationCount >= batchSize) {
                    await batch.commit();
                    batch = db.batch();
                    operationCount = 0;
                }
            }
            // Update notification document
            batch.update(notifDoc.ref, {
                readCount: readBy.length,
                // Keep readBy for backwards compatibility during transition period
                // readBy: admin.firestore.FieldValue.delete(), // Uncomment after migration is verified
            });
            operationCount++;
            migratedCount++;
            // Commit batch if limit reached
            if (operationCount >= batchSize) {
                await batch.commit();
                batch = db.batch();
                operationCount = 0;
            }
        }
        catch (error) {
            console.error(`Error migrating notification ${notifDoc.id}:`, error);
            errorCount++;
        }
    }
    // Commit remaining operations
    if (operationCount > 0) {
        await batch.commit();
    }
    console.log(`Migration complete: ${migratedCount} notifications, ${errorCount} errors`);
    return {
        success: true,
        migrated: migratedCount,
        errors: errorCount,
        message: `${migratedCount}件の通知を移行しました (エラー: ${errorCount}件)`
    };
});
// ===== POINT HISTORY AGGREGATION (Cost Reduction) =====
/**
 * Helper: Get yesterday's date string in JST (YYYY-MM-DD)
 */
function getYesterdayDateString() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    jst.setDate(jst.getDate() - 1);
    return jst.toISOString().split('T')[0];
}
/**
 * Helper: Get start of yesterday in JST as Firestore Timestamp
 */
function getYesterdayStart() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    jst.setDate(jst.getDate() - 1);
    jst.setHours(0, 0, 0, 0);
    // Convert back to UTC for Firestore
    const utc = new Date(jst.getTime() - 9 * 60 * 60 * 1000);
    return admin.firestore.Timestamp.fromDate(utc);
}
/**
 * Helper: Get start of today in JST as Firestore Timestamp
 */
function getTodayStart() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    jst.setHours(0, 0, 0, 0);
    // Convert back to UTC for Firestore
    const utc = new Date(jst.getTime() - 9 * 60 * 60 * 1000);
    return admin.firestore.Timestamp.fromDate(utc);
}
/**
 * Daily scheduled function to aggregate point history
 * Runs at midnight JST every day
 * Creates daily summaries in pointAggregations/{userId}/daily/{YYYY-MM-DD}
 */
exports.aggregatePointHistory = functions.scheduler.onSchedule({
    schedule: '0 0 * * *', // Midnight every day
    timeZone: 'Asia/Tokyo',
}, async () => {
    console.log('Starting daily point history aggregation...');
    const yesterday = getYesterdayDateString();
    const yesterdayStart = getYesterdayStart();
    const todayStart = getTodayStart();
    // Get all users
    const usersSnap = await db.collection('users').get();
    console.log(`Processing ${usersSnap.size} users for date ${yesterday}`);
    let processedCount = 0;
    let errorCount = 0;
    // Process users in batches
    const batchSize = 100;
    const userDocs = usersSnap.docs;
    for (let i = 0; i < userDocs.length; i += batchSize) {
        const batch = userDocs.slice(i, i + batchSize);
        await Promise.all(batch.map(async (userDoc) => {
            try {
                // Get point history for this user from yesterday
                const pointHistorySnap = await db.collection('pointHistory')
                    .where('userId', '==', userDoc.id)
                    .where('createdAt', '>=', yesterdayStart)
                    .where('createdAt', '<', todayStart)
                    .get();
                if (pointHistorySnap.empty) {
                    // No activity, skip aggregation
                    return;
                }
                // Aggregate by reason
                const aggregation = {
                    totalPoints: 0,
                    login_bonus: 0,
                    survey: 0,
                    admin_grant: 0,
                    admin_deduct: 0,
                    admin_clear: 0,
                    game_result: 0,
                };
                pointHistorySnap.forEach(doc => {
                    const data = doc.data();
                    aggregation.totalPoints += data.points || 0;
                    const reason = data.reason;
                    if (reason in aggregation) {
                        aggregation[reason] += data.points || 0;
                    }
                });
                // Write aggregation
                await db.collection('pointAggregations')
                    .doc(userDoc.id)
                    .collection('daily')
                    .doc(yesterday)
                    .set({
                    ...aggregation,
                    transactionCount: pointHistorySnap.size,
                    aggregatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                processedCount++;
            }
            catch (error) {
                console.error(`Error aggregating for user ${userDoc.id}:`, error);
                errorCount++;
            }
        }));
    }
    console.log(`Aggregation complete: ${processedCount} users processed, ${errorCount} errors`);
});
/**
 * Manual trigger for point aggregation (for testing or backfill)
 * Admin-only callable function
 */
exports.triggerPointAggregation = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者権限が必要です');
    }
    // Trigger the aggregation manually (will process yesterday's data)
    console.log('Manual aggregation triggered by admin:', request.auth.uid);
    // Run aggregation logic inline
    const yesterday = getYesterdayDateString();
    const yesterdayStart = getYesterdayStart();
    const todayStart = getTodayStart();
    const usersSnap = await db.collection('users').get();
    let processedCount = 0;
    for (const userDoc of usersSnap.docs) {
        const pointHistorySnap = await db.collection('pointHistory')
            .where('userId', '==', userDoc.id)
            .where('createdAt', '>=', yesterdayStart)
            .where('createdAt', '<', todayStart)
            .get();
        if (pointHistorySnap.empty)
            continue;
        const aggregation = {
            totalPoints: 0,
            login_bonus: 0,
            survey: 0,
            admin_grant: 0,
            admin_deduct: 0,
            admin_clear: 0,
            game_result: 0,
        };
        pointHistorySnap.forEach(doc => {
            const data = doc.data();
            aggregation.totalPoints += data.points || 0;
            const reason = data.reason;
            if (reason in aggregation) {
                aggregation[reason] += data.points || 0;
            }
        });
        await db.collection('pointAggregations')
            .doc(userDoc.id)
            .collection('daily')
            .doc(yesterday)
            .set({
            ...aggregation,
            transactionCount: pointHistorySnap.size,
            aggregatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        processedCount++;
    }
    return {
        success: true,
        date: yesterday,
        processedUsers: processedCount,
        message: `${yesterday}のポイント履歴を${processedCount}件集計しました`
    };
});
// ===== CLASS MEMBER TRACKING (Cost Reduction) =====
/**
 * Track class membership changes when a user's grade/class is updated
 * Updates memberIds array in classes collection for efficient member lookup
 */
exports.updateClassMembers = functions.firestore.onDocumentWritten('users/{userId}', async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    // Skip if no change in grade/class
    const oldGrade = beforeData?.grade;
    const oldClass = beforeData?.class;
    const newGrade = afterData?.grade;
    const newClass = afterData?.class;
    // Determine old and new class IDs
    const oldClassId = (oldGrade && oldClass) ? `${oldGrade}-${oldClass}` : null;
    const newClassId = (newGrade && newClass) ? `${newGrade}-${newClass}` : null;
    // If class didn't change, skip
    if (oldClassId === newClassId) {
        return;
    }
    console.log(`User ${userId} class changed from ${oldClassId} to ${newClassId}`);
    try {
        // Remove from old class
        if (oldClassId) {
            const oldClassRef = db.collection('classes').doc(oldClassId);
            await oldClassRef.update({
                memberIds: admin.firestore.FieldValue.arrayRemove(userId),
                memberCount: admin.firestore.FieldValue.increment(-1)
            }).catch((error) => {
                // Class might not exist yet, that's OK
                console.log(`Could not update old class ${oldClassId}:`, error.message);
            });
        }
        // Add to new class
        if (newClassId) {
            const newClassRef = db.collection('classes').doc(newClassId);
            const newClassDoc = await newClassRef.get();
            if (newClassDoc.exists) {
                await newClassRef.update({
                    memberIds: admin.firestore.FieldValue.arrayUnion(userId),
                    memberCount: admin.firestore.FieldValue.increment(1)
                });
            }
            else {
                // Create the class document if it doesn't exist
                await newClassRef.set({
                    grade: newGrade,
                    className: newClass,
                    totalPoints: 0,
                    memberCount: 1,
                    memberIds: [userId]
                });
            }
        }
    }
    catch (error) {
        console.error(`Error updating class membership for user ${userId}:`, error);
    }
});
/**
 * Initialize memberIds for all existing classes
 * One-time migration function
 */
exports.initializeClassMembers = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者権限が必要です');
    }
    console.log('Starting class member initialization...');
    // Get all users and group by class
    const usersSnap = await db.collection('users').get();
    const classMemberMap = {};
    usersSnap.forEach(userDoc => {
        const data = userDoc.data();
        if (data.grade && data.class) {
            const classId = `${data.grade}-${data.class}`;
            if (!classMemberMap[classId]) {
                classMemberMap[classId] = [];
            }
            classMemberMap[classId].push(userDoc.id);
        }
    });
    // Update each class with memberIds
    let updatedCount = 0;
    for (const [classId, memberIds] of Object.entries(classMemberMap)) {
        const classRef = db.collection('classes').doc(classId);
        const classDoc = await classRef.get();
        if (classDoc.exists) {
            await classRef.update({
                memberIds,
                memberCount: memberIds.length
            });
        }
        else {
            // Parse class info from ID
            const [gradeStr, className] = classId.split('-');
            await classRef.set({
                grade: parseInt(gradeStr, 10),
                className,
                totalPoints: 0,
                memberCount: memberIds.length,
                memberIds
            });
        }
        updatedCount++;
    }
    return {
        success: true,
        classesUpdated: updatedCount,
        totalUsers: usersSnap.size,
        message: `${updatedCount}クラスのメンバーリストを初期化しました`
    };
});
// 学年・クラス単位での一括配布（チケット・ポイント）
exports.bulkDistributeByClass = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data().role)) {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { grade, classNames, tickets, points, details } = request.data;
    // Validate input
    if ((tickets == null || tickets <= 0) && (points == null || points <= 0)) {
        throw new functions.https.HttpsError('invalid-argument', 'チケットまたはポイントを指定してください');
    }
    const ticketsToGrant = tickets && tickets > 0 ? tickets : 0;
    const pointsToGrant = points && points > 0 ? points : 0;
    // Build query
    let usersQuery = db.collection('users');
    if (grade != null) {
        usersQuery = usersQuery.where('grade', '==', grade);
    }
    // Execute query
    const usersSnap = await usersQuery.get();
    if (usersSnap.empty) {
        return {
            success: true,
            message: '対象ユーザーが見つかりませんでした',
            successCount: 0,
            totalCount: 0,
        };
    }
    // Filter by class if specified
    let targetUsers = usersSnap.docs;
    if (classNames && classNames.length > 0) {
        targetUsers = targetUsers.filter(doc => {
            const userData = doc.data();
            return userData.class && classNames.includes(userData.class);
        });
    }
    if (targetUsers.length === 0) {
        return {
            success: true,
            message: '対象ユーザーが見つかりませんでした',
            successCount: 0,
            totalCount: 0,
        };
    }
    let successCount = 0;
    const errors = [];
    const batchSize = 50;
    // Process in batches
    for (let i = 0; i < targetUsers.length; i += batchSize) {
        const batch = targetUsers.slice(i, i + batchSize);
        for (const userDoc of batch) {
            try {
                const userId = userDoc.id;
                const userData = userDoc.data();
                const userDocRef = db.collection('users').doc(userId);
                const classRef = getClassRef(userData);
                await db.runTransaction(async (transaction) => {
                    // Read phase
                    const classDoc = classRef && pointsToGrant > 0 ? await transaction.get(classRef) : null;
                    // Write phase
                    const updateData = {};
                    if (ticketsToGrant > 0) {
                        updateData.gachaTickets = admin.firestore.FieldValue.increment(ticketsToGrant);
                        const ticketHistoryRef = db.collection('ticketHistory').doc();
                        transaction.set(ticketHistoryRef, {
                            userId,
                            tickets: ticketsToGrant,
                            reason: 'admin_grant',
                            details: details || '一括配布',
                            grantedBy: request.auth.uid,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                    if (pointsToGrant > 0) {
                        updateData.totalPoints = admin.firestore.FieldValue.increment(pointsToGrant);
                        const pointHistoryRef = db.collection('pointHistory').doc();
                        transaction.set(pointHistoryRef, {
                            userId,
                            points: pointsToGrant,
                            reason: 'admin_grant',
                            details: details || '一括配布',
                            grantedBy: request.auth.uid,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        if (classRef && classDoc) {
                            writeClassPoints(transaction, classRef, classDoc, userData, pointsToGrant);
                        }
                    }
                    transaction.update(userDocRef, updateData);
                });
                successCount++;
            }
            catch (err) {
                errors.push(`${userDoc.data().username || userDoc.id}: ${String(err)}`);
            }
        }
    }
    // Log admin action
    await logAdminAction(request.auth.uid, 'bulk_distribute', {
        grade,
        classNames,
        tickets: ticketsToGrant,
        points: pointsToGrant,
        details,
        successCount,
        totalCount: targetUsers.length,
    });
    const resultParts = [];
    if (ticketsToGrant > 0)
        resultParts.push(`${ticketsToGrant}チケット`);
    if (pointsToGrant > 0)
        resultParts.push(`${pointsToGrant}pt`);
    return {
        success: true,
        message: `${successCount}/${targetUsers.length}人に${resultParts.join('と')}を配布しました`,
        successCount,
        totalCount: targetUsers.length,
        errors: errors.length > 0 ? errors : undefined,
    };
});
// ============================================================
// Cloudflare R2 画像アップロード
// ============================================================
// R2 Secrets定義
const r2AccessKeyId = (0, params_1.defineSecret)('R2_ACCESS_KEY_ID');
const r2SecretAccessKey = (0, params_1.defineSecret)('R2_SECRET_ACCESS_KEY');
const r2AccountId = (0, params_1.defineSecret)('R2_ACCOUNT_ID');
const r2BucketName = (0, params_1.defineSecret)('R2_BUCKET_NAME');
const r2PublicUrl = (0, params_1.defineSecret)('R2_PUBLIC_URL');
// プリサインドアップロードURL生成
exports.getUploadUrl = functions.https.onCall({
    secrets: [r2AccessKeyId, r2SecretAccessKey, r2AccountId, r2BucketName, r2PublicUrl],
}, async (request) => {
    // 認証チェック
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const { fileName, fileType, fileSize } = request.data;
    // ファイルタイプ検証
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!fileType || !allowedTypes.includes(fileType)) {
        throw new functions.https.HttpsError('invalid-argument', '対応していないファイル形式です。JPEG, PNG, WebP, GIFのみ対応しています。');
    }
    // ファイル名検証
    if (!fileName || typeof fileName !== 'string' || fileName.length > 200) {
        throw new functions.https.HttpsError('invalid-argument', 'ファイル名が不正です');
    }
    if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_UPLOAD_SIZE_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', '画像サイズが大きすぎます');
    }
    const safeFileSize = fileSize;
    try {
        // デバッグ: Secretsの値を確認（最初の8文字のみ）
        const accountId = r2AccountId.value();
        const accessKey = r2AccessKeyId.value();
        const secretKey = r2SecretAccessKey.value();
        console.log('R2 Config:', {
            accountIdPrefix: accountId?.substring(0, 8),
            accountIdLength: accountId?.length,
            hasAccessKey: !!accessKey,
            hasSecretKey: !!secretKey,
        });
        // R2クライアントの初期化
        const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
        console.log('R2 Endpoint:', endpoint);
        const r2Client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint,
            forcePathStyle: true, // R2はパススタイルURL必須
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
            },
        });
        // ユニークなファイル名生成
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `users/${request.auth.uid}/${timestamp}_${randomStr}_${sanitizedFileName}`;
        const bucketName = r2BucketName.value();
        console.log('Creating PutObjectCommand:', { bucketName, key, fileType });
        // プリサインドURL生成（15分間有効）
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: fileType,
            ContentLength: safeFileSize,
        });
        console.log('Calling getSignedUrl...');
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(r2Client, command, {
            expiresIn: 900, // 15分
        });
        console.log('getSignedUrl success, URL length:', uploadUrl?.length);
        // 公開URL
        const publicUrl = `${r2PublicUrl.value()}/${key}`;
        // ログ記録
        await db.collection('uploadLogs').add({
            userId: request.auth.uid,
            fileName: sanitizedFileName,
            fileType,
            fileSize: safeFileSize,
            key,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            uploadUrl,
            publicUrl,
            key,
        };
    }
    catch (error) {
        console.error('Failed to generate upload URL:', error);
        throw new functions.https.HttpsError('internal', 'アップロードURLの生成に失敗しました');
    }
});
exports.toggleExecutiveQALike = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const { questionId } = request.data;
    if (!questionId || typeof questionId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', '質問IDが不正です');
    }
    const questionRef = db.collection('executiveQA').doc(questionId);
    const uid = request.auth.uid;
    const result = await db.runTransaction(async (transaction) => {
        const questionDoc = await transaction.get(questionRef);
        if (!questionDoc.exists) {
            throw new functions.https.HttpsError('not-found', '質問が見つかりません');
        }
        const data = questionDoc.data() || {};
        const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
        const hasLiked = likedBy.includes(uid);
        const nextLikedBy = hasLiked
            ? likedBy.filter((id) => id !== uid)
            : [...likedBy, uid];
        transaction.update(questionRef, {
            likedBy: nextLikedBy,
            likes: nextLikedBy.length,
        });
        return { liked: !hasLiked, likes: nextLikedBy.length };
    });
    return {
        success: true,
        ...result,
    };
});
// スタンプラリー: コード検証 & スタンプ記録
exports.verifyStampCode = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    await assertValidDomain(request.auth.token?.email || '');
    const uid = request.auth.uid;
    const { stampCode } = request.data;
    if (!stampCode || typeof stampCode !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'スタンプコードが不正です');
    }
    // Find booth by stampCode
    const boothSnap = await db.collection('booths')
        .where('stampCode', '==', stampCode.trim().toUpperCase())
        .where('isActive', '==', true)
        .limit(1)
        .get();
    if (boothSnap.empty) {
        throw new functions.https.HttpsError('not-found', '無効なスタンプコードです');
    }
    const boothDoc = boothSnap.docs[0];
    const boothData = boothDoc.data();
    const boothId = boothDoc.id;
    // Check if already stamped
    const existingStamp = await db.collection('stampRally')
        .where('userId', '==', uid)
        .where('boothId', '==', boothId)
        .limit(1)
        .get();
    if (!existingStamp.empty) {
        return { success: false, message: 'このブースは既にスタンプ済みです', boothName: boothData.name };
    }
    const pointsAwarded = boothData.points || 5;
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
    }
    const userData = userDoc.data();
    const classRef = getClassRef(userData);
    await db.runTransaction(async (transaction) => {
        const classDoc = classRef ? await transaction.get(classRef) : null;
        // Record stamp
        const stampRef = db.collection('stampRally').doc();
        transaction.set(stampRef, {
            userId: uid,
            boothId,
            visitedAt: admin.firestore.FieldValue.serverTimestamp(),
            pointsAwarded,
        });
        // Award points
        if (pointsAwarded > 0) {
            const historyRef = db.collection('pointHistory').doc();
            transaction.set(historyRef, {
                userId: uid,
                points: pointsAwarded,
                reason: 'game_result',
                details: `スタンプラリー: ${boothData.name}`,
                grantedBy: 'system',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            transaction.update(userDocRef, {
                totalPoints: admin.firestore.FieldValue.increment(pointsAwarded),
            });
            if (classRef && classDoc) {
                writeClassPoints(transaction, classRef, classDoc, userData, pointsAwarded);
            }
        }
    });
    // Check if stamp rally complete
    const allBooths = await db.collection('booths').where('isActive', '==', true).where('stampCode', '!=', '').get();
    const userStamps = await db.collection('stampRally').where('userId', '==', uid).get();
    const isComplete = userStamps.size + 1 >= allBooths.size; // +1 for the one just added
    // Award stamp rally completion badge
    if (isComplete) {
        const currentBadges = userData.badges || [];
        if (!currentBadges.includes('stamp_rally_complete')) {
            await userDocRef.update({
                badges: admin.firestore.FieldValue.arrayUnion('stamp_rally_complete'),
            });
        }
    }
    return {
        success: true,
        message: `${boothData.name}のスタンプを獲得しました！`,
        boothName: boothData.name,
        pointsAwarded,
        isComplete,
    };
});
//# sourceMappingURL=index.js.map