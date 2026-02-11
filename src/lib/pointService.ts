import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase';
import type { PointHistory } from '../types/firestore';
import app from './firebase';

const functions = getFunctions(app);

const awardLoginBonusFn = httpsCallable<void, { success: boolean; message: string; points?: number; tickets?: number }>(functions, 'awardLoginBonus');
const grantPointsFn = httpsCallable<{ userId: string; points: number; reason?: string; details?: string }, { success: boolean; message: string }>(functions, 'grantPoints');
const deductPointsFn = httpsCallable<{ userId: string; points: number; reason?: string; details?: string }, { success: boolean; message: string; actualDeducted: number }>(functions, 'deductPoints');
const clearPointsFn = httpsCallable<{ userId: string }, { success: boolean; message: string; clearedAmount: number }>(functions, 'clearPoints');
const bulkGrantPointsFn = httpsCallable<{ userIds: string[]; points: number; reason?: string; details?: string }, { success: boolean; message: string; successCount: number; totalCount: number; errors?: string[] }>(functions, 'bulkGrantPoints');
const bulkDeductPointsFn = httpsCallable<{ userIds: string[]; points: number; reason?: string; details?: string }, { success: boolean; message: string; successCount: number; totalCount: number; totalDeducted: number; errors?: string[] }>(functions, 'bulkDeductPoints');

export async function awardLoginBonus(): Promise<{ success: boolean; points?: number; tickets?: number }> {
  const result = await awardLoginBonusFn();
  return result.data;
}

export async function grantPoints(userId: string, points: number, reason?: string, details?: string): Promise<void> {
  await grantPointsFn({ userId, points, reason, details });
}

export async function deductPoints(userId: string, points: number, reason?: string, details?: string): Promise<{ actualDeducted: number }> {
  const result = await deductPointsFn({ userId, points, reason, details });
  return { actualDeducted: result.data.actualDeducted };
}

export async function clearPoints(userId: string): Promise<{ clearedAmount: number }> {
  const result = await clearPointsFn({ userId });
  return { clearedAmount: result.data.clearedAmount };
}

export async function bulkGrantPoints(userIds: string[], points: number, reason?: string, details?: string): Promise<{ successCount: number; totalCount: number; message: string; errors?: string[] }> {
  const result = await bulkGrantPointsFn({ userIds, points, reason, details });
  return result.data;
}

export async function bulkDeductPoints(userIds: string[], points: number, reason?: string, details?: string): Promise<{ successCount: number; totalCount: number; totalDeducted: number; message: string; errors?: string[] }> {
  const result = await bulkDeductPointsFn({ userIds, points, reason, details });
  return result.data;
}

export async function getPointHistory(
  userId: string,
  limitCount: number = 20
): Promise<Array<PointHistory & { id: string }>> {
  const q = query(
    collection(db, 'pointHistory'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  const history: Array<PointHistory & { id: string }> = [];

  querySnapshot.forEach((docSnap) => {
    history.push({
      id: docSnap.id,
      ...docSnap.data() as PointHistory,
    });
  });

  return history;
}
