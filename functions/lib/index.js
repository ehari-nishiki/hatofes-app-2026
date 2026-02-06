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
exports.pullGacha = exports.submitTetrisScore = exports.clearPoints = exports.deductPoints = exports.bulkDeductGachaTickets = exports.bulkGrantGachaTickets = exports.clearGachaTickets = exports.deductGachaTickets = exports.grantGachaTickets = exports.changeUsername = exports.updateUserRole = exports.submitSurveyResponse = exports.bulkDeductPoints = exports.bulkGrantPoints = exports.grantPoints = exports.updateLoginBonusConfig = exports.awardLoginBonus = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const googleapis_1 = require("googleapis");
admin.initializeApp();
const db = admin.firestore();
function isValidDomain(email) {
    if (process.env.RESTRICT_DOMAIN !== 'true')
        return true;
    return email.endsWith('@g.nagano-c.ed.jp');
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    // ログインボーナス設定を取得（デフォルト: 10pt + 1チケット）
    const configDoc = await db.collection('config').doc('loginBonus').get();
    const bonusPoints = configDoc.exists ? (configDoc.data().points || 10) : 10;
    const bonusTickets = configDoc.exists ? (configDoc.data().tickets || 1) : 1;
    const classRef = getClassRef(userData);
    await db.runTransaction(async (transaction) => {
        // --- reads first ---
        const classDoc = classRef && bonusPoints > 0 ? await transaction.get(classRef) : null;
        // --- writes ---
        if (bonusPoints > 0) {
            const historyRef = db.collection('pointHistory').doc();
            transaction.set(historyRef, {
                userId: uid,
                points: bonusPoints,
                reason: 'login_bonus',
                details: `ログインボーナス（${today}）`,
                grantedBy: 'system',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        transaction.update(userDocRef, {
            totalPoints: admin.firestore.FieldValue.increment(bonusPoints),
            lastLoginDate: today,
            gachaTickets: admin.firestore.FieldValue.increment(bonusTickets),
        });
        if (classRef && classDoc && bonusPoints > 0) {
            writeClassPoints(transaction, classRef, classDoc, userData, bonusPoints);
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
    return { success: true, message: 'ログインボーナスを付与しました', points: bonusPoints, tickets: bonusTickets };
});
// ログインボーナス設定更新（admin用）
exports.updateLoginBonusConfig = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { points, tickets } = request.data;
    if (typeof points !== 'number' || points < 0 || typeof tickets !== 'number' || tickets < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    await db.collection('config').doc('loginBonus').set({
        points,
        tickets,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
    });
    return { success: true, message: 'ログインボーナス設定を更新しました' };
});
// 管理者によるポイント付与
exports.grantPoints = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    return { success: true, message: 'ポイントを付与しました' };
});
// 一括ポイント付与（admin/staff用）
exports.bulkGrantPoints = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    return { success: true, pointsAwarded, message: 'アンケートに回答しました' };
});
// ロール変更（admin用）
exports.updateUserRole = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
    const adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
    }
    const { userId, role } = request.data;
    const validRoles = ['student', 'teacher', 'staff', 'admin'];
    if (!userId || !validRoles.includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
    }
    await db.collection('users').doc(userId).update({ role });
    return { success: true, message: 'ロールを更新しました' };
});
// ユーザーネーム変更（単語リスト縛り）
const MAX_USERNAME_CHANGES = 3;
exports.changeUsername = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
// テトリススコア提出（生徒のみ）— 日別カウント制
exports.submitTetrisScore = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    // ポイント計算ロジック：
    // 1~10列: 列数×10pt、11~100列: 列数×1pt、101列~: ポイントなし
    // 既に100列を超えている場合は、もうポイントなし
    let pointsAwarded = 0;
    if (currentTotal >= 100) {
        // 既に100列超えている → もうポイントはもらえない
        pointsAwarded = 0;
    }
    else if (newTotal <= 10) {
        // まだ10列以下 → 今回の列数×10pt
        pointsAwarded = linesCleared * 10;
    }
    else if (currentTotal < 10 && newTotal > 10) {
        // 10列をまたぐ場合
        // 10列までの分は×10pt、それ以降は×1pt（ただし100列まで）
        const pointsUpTo10 = (10 - currentTotal) * 10;
        const linesAfter10 = Math.min(newTotal - 10, 100 - 10);
        const pointsAfter10 = linesAfter10 * 1;
        pointsAwarded = pointsUpTo10 + pointsAfter10;
    }
    else if (currentTotal >= 10 && newTotal <= 100) {
        // 11~100列の範囲内 → 今回の列数×1pt
        pointsAwarded = linesCleared * 1;
    }
    else if (currentTotal < 100 && newTotal > 100) {
        // 100列をまたぐ場合
        const linesUpTo100 = 100 - currentTotal;
        pointsAwarded = linesUpTo100 * 1;
    }
    else {
        // 101列以降 → ポイントなし
        pointsAwarded = 0;
    }
    const classRef = getClassRef(userData);
    const tetrisScoreRef = db.collection('tetrisScores').doc(uid);
    await db.runTransaction(async (transaction) => {
        // --- reads first ---
        const classDoc = classRef && pointsAwarded > 0 ? await transaction.get(classRef) : null;
        const tetrisScoreDoc = await transaction.get(tetrisScoreRef);
        // --- writes ---
        // tetrisStats を更新
        transaction.set(tetrisStatsRef, {
            date: today,
            totalLinesCleared: newTotal,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        // tetrisScores を更新（ランキング用）
        if (score !== undefined) {
            const existingData = tetrisScoreDoc.exists ? tetrisScoreDoc.data() : null;
            const currentHighScore = existingData?.highScore || 0;
            const currentMaxLines = existingData?.maxLines || 0;
            const currentTotalGames = existingData?.totalGames || 0;
            transaction.set(tetrisScoreRef, {
                userId: uid,
                username: userData.username,
                grade: userData.grade,
                class: userData.class,
                highScore: Math.max(currentHighScore, score),
                maxLines: Math.max(currentMaxLines, linesCleared),
                totalGames: currentTotalGames + 1,
                lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
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
    return {
        success: true,
        pointsAwarded,
        totalToday: newTotal,
        maxToday: 100,
        message: newTotal > 100 ? '本日の上限（100列）に達しました' : undefined
    };
});
// ガチャを引く
exports.pullGacha = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const email = request.auth.token?.email || '';
    if (!isValidDomain(email)) {
        throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
    }
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
    return {
        success: true,
        item: {
            id: selected.id,
            name: selected.name,
            rarity: selected.rarity,
            type: selected.type,
            pointsValue: selected.pointsValue ?? null,
            ticketValue: selected.ticketValue ?? null,
        },
    };
});
//# sourceMappingURL=index.js.map