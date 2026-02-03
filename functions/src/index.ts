import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

function isValidDomain(email: string): boolean {
  // 本番用: return email.endsWith('@g.nagano-c.ed.jp');
  // 開発用: 特定のメールも許可
  const allowedEmails = ['ebi.sandwich.finland@gmail.com'];
  return email.endsWith('@g.nagano-c.ed.jp') || allowedEmails.includes(email);
}

// ログインボーナス付与
export const awardLoginBonus = functions.https.onCall(async (request) => {
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

  const userData = userDoc.data()!;

  // JST で今日の日付
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().split('T')[0];

  if (userData.lastLoginDate === today) {
    return { success: false, message: '今日のログインボーナスは既に受け取っています' };
  }

  const BONUS_POINTS = 10;

  await db.runTransaction(async (transaction) => {
    const historyRef = db.collection('pointHistory').doc();
    transaction.set(historyRef, {
      userId: uid,
      points: BONUS_POINTS,
      reason: 'login_bonus',
      details: `ログインボーナス（${today}）`,
      grantedBy: 'system',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(userDocRef, {
      totalPoints: admin.firestore.FieldValue.increment(BONUS_POINTS),
      lastLoginDate: today,
    });

    const classId = `${userData.grade}-${userData.class}`;
    transaction.update(db.collection('classes').doc(classId), {
      totalPoints: admin.firestore.FieldValue.increment(BONUS_POINTS),
    });
  });

  return { success: true, message: 'ログインボーナスを付与しました', points: BONUS_POINTS };
});

// 管理者によるポイント付与
export const grantPoints = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
  }

  const email = request.auth.token?.email || '';
  if (!isValidDomain(email)) {
    throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
  }

  const adminDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!adminDoc.exists || !['admin', 'staff'].includes(adminDoc.data()!.role)) {
    throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
  }

  const { userId, points, reason, details } = request.data as {
    userId: string;
    points: number;
    reason?: string;
    details?: string;
  };

  if (!userId || typeof points !== 'number' || points <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
  }

  const userDocRef = db.collection('users').doc(userId);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data()!;

  await db.runTransaction(async (transaction) => {
    const historyRef = db.collection('pointHistory').doc();
    transaction.set(historyRef, {
      userId,
      points,
      reason: reason || 'admin_grant',
      details: details || '管理者による付与',
      grantedBy: request.auth!.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(userDocRef, {
      totalPoints: admin.firestore.FieldValue.increment(points),
    });

    const classId = `${userData.grade}-${userData.class}`;
    transaction.update(db.collection('classes').doc(classId), {
      totalPoints: admin.firestore.FieldValue.increment(points),
    });
  });

  return { success: true, message: 'ポイントを付与しました' };
});

// アンケート回答時のポイント付与
export const submitSurveyResponse = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
  }

  const email = request.auth.token?.email || '';
  if (!isValidDomain(email)) {
    throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
  }

  const uid = request.auth.uid;
  const { surveyId, answers } = request.data as { surveyId: string; answers: unknown[] };

  if (!surveyId || !Array.isArray(answers)) {
    throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
  }

  const surveyDoc = await db.collection('surveys').doc(surveyId).get();
  if (!surveyDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'アンケートが見つかりません');
  }

  const surveyData = surveyDoc.data()!;

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

  const pointsAwarded: number = surveyData.points || 0;
  const userDocRef = db.collection('users').doc(uid);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
  }

  const userData = userDoc.data()!;

  await db.runTransaction(async (transaction) => {
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

      const classId = `${userData.grade}-${userData.class}`;
      transaction.update(db.collection('classes').doc(classId), {
        totalPoints: admin.firestore.FieldValue.increment(pointsAwarded),
      });
    }
  });

  return { success: true, pointsAwarded, message: 'アンケートに回答しました' };
});

// ロール変更（admin用）
export const updateUserRole = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
  }

  const email = request.auth.token?.email || '';
  if (!isValidDomain(email)) {
    throw new functions.https.HttpsError('permission-denied', 'ドメインが無効です');
  }

  const adminDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!adminDoc.exists || adminDoc.data()!.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', '管理者のみ使用可能です');
  }

  const { userId, role } = request.data as { userId: string; role: string };
  const validRoles = ['student', 'teacher', 'staff', 'admin'];

  if (!userId || !validRoles.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'パラメータが不正です');
  }

  await db.collection('users').doc(userId).update({ role });

  return { success: true, message: 'ロールを更新しました' };
});
