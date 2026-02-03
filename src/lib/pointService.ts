import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { PointHistory, PointReason } from '../types/firestore';
import { generateClassId } from './classUtils';

/**
 * Award points to a user and create point history
 * @param userId - User ID to award points to
 * @param points - Number of points to award
 * @param reason - Reason for awarding points
 * @param details - Additional details
 * @param grantedBy - User ID of the admin who granted points (optional)
 */
export async function awardPoints(
  userId: string,
  points: number,
  reason: PointReason,
  details: string,
  grantedBy?: string
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userDocRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const newTotalPoints = (userData.totalPoints || 0) + points;

      // Update user's total points
      transaction.update(userDocRef, {
        totalPoints: newTotalPoints,
      });

      // Update class total points if user is a student
      if (userData.grade && userData.class) {
        const classId = generateClassId(userData.grade, userData.class);
        const classDocRef = doc(db, 'classes', classId);
        const classDoc = await transaction.get(classDocRef);

        if (classDoc.exists()) {
          const classData = classDoc.data();
          const newClassPoints = (classData.totalPoints || 0) + points;
          transaction.update(classDocRef, {
            totalPoints: newClassPoints,
          });
        }
      }

      // Create point history record
      const pointHistoryRef = collection(db, 'pointHistory');
      const pointHistoryData: PointHistory = {
        userId,
        points,
        reason,
        details,
        grantedBy,
        createdAt: Timestamp.now(),
      };

      const newHistoryRef = doc(pointHistoryRef);
      transaction.set(newHistoryRef, pointHistoryData);
    });
  } catch (error) {
    console.error('Error awarding points:', error);
    throw error;
  }
}

/**
 * Check if user should receive login bonus today
 * @param userId - User ID to check
 * @returns True if user should receive login bonus (hasn't received it today)
 */
export async function checkLoginBonus(userId: string): Promise<boolean> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();
    const lastLoginDate = userData.lastLoginDate;

    // Get today's date in YYYY-MM-DD format (JST)
    const today = new Date();
    const jstDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const todayStr = jstDate.toISOString().split('T')[0];

    // Return true if last login was NOT today (should award bonus)
    return lastLoginDate !== todayStr;
  } catch (error) {
    console.error('Error checking login bonus:', error);
    return false;
  }
}

/**
 * Award login bonus to user
 * @param userId - User ID to award login bonus to
 * @param _grade - User's grade (optional, for future use)
 * @param _className - User's class (optional, for future use)
 * @returns Number of points awarded
 */
export async function awardLoginBonus(
  userId: string,
  _grade?: number,
  _className?: string
): Promise<number> {
  try {
    // Check if already awarded today
    const shouldAward = await checkLoginBonus(userId);
    if (!shouldAward) {
      console.log('Login bonus already awarded today');
      return 0;
    }

    // Get today's date in YYYY-MM-DD format (JST)
    const today = new Date();
    const jstDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const todayStr = jstDate.toISOString().split('T')[0];

    // Update lastLoginDate
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      lastLoginDate: todayStr,
    });

    // Award 10 points
    const loginBonusPoints = 10;
    await awardPoints(userId, loginBonusPoints, 'login_bonus', 'ログインボーナス');

    return loginBonusPoints;
  } catch (error) {
    console.error('Error awarding login bonus:', error);
    throw error;
  }
}

/**
 * Get point history for a user
 * @param userId - User ID to get history for
 * @param limitCount - Number of records to fetch (default: 20)
 * @returns Array of point history records
 */
export async function getPointHistory(
  userId: string,
  limitCount: number = 20
): Promise<Array<PointHistory & { id: string }>> {
  try {
    const pointHistoryRef = collection(db, 'pointHistory');
    const q = query(
      pointHistoryRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const history: Array<PointHistory & { id: string }> = [];

    querySnapshot.forEach((doc) => {
      history.push({
        id: doc.id,
        ...doc.data() as PointHistory,
      });
    });

    return history;
  } catch (error) {
    console.error('Error fetching point history:', error);
    return [];
  }
}

/**
 * Update class points directly (used for manual adjustments)
 * @param classId - Class ID (e.g., "1-A")
 * @param points - Number of points to add
 */
export async function updateClassPoints(classId: string, points: number): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const classDocRef = doc(db, 'classes', classId);
      const classDoc = await transaction.get(classDocRef);

      if (classDoc.exists()) {
        const classData = classDoc.data();
        const newPoints = (classData.totalPoints || 0) + points;
        transaction.update(classDocRef, {
          totalPoints: newPoints,
        });
      }
    });
  } catch (error) {
    console.error('Error updating class points:', error);
    throw error;
  }
}
