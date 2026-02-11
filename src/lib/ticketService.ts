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
import app from './firebase';

const functions = getFunctions(app);

const grantGachaTicketsFn = httpsCallable<
  { userId: string; tickets: number; details?: string },
  { success: boolean; message: string }
>(functions, 'grantGachaTickets');

const deductGachaTicketsFn = httpsCallable<
  { userId: string; tickets: number; details?: string },
  { success: boolean; message: string; actualDeducted: number }
>(functions, 'deductGachaTickets');

const clearGachaTicketsFn = httpsCallable<
  { userId: string },
  { success: boolean; message: string; clearedAmount: number }
>(functions, 'clearGachaTickets');

const bulkGrantGachaTicketsFn = httpsCallable<
  { userIds: string[]; tickets: number; details?: string },
  { success: boolean; message: string; successCount: number; totalCount: number; errors?: string[] }
>(functions, 'bulkGrantGachaTickets');

const bulkDeductGachaTicketsFn = httpsCallable<
  { userIds: string[]; tickets: number; details?: string },
  { success: boolean; message: string; successCount: number; totalCount: number; totalDeducted: number; errors?: string[] }
>(functions, 'bulkDeductGachaTickets');

export async function grantGachaTickets(userId: string, tickets: number, details?: string): Promise<void> {
  await grantGachaTicketsFn({ userId, tickets, details });
}

export async function deductGachaTickets(userId: string, tickets: number, details?: string): Promise<{ actualDeducted: number }> {
  const result = await deductGachaTicketsFn({ userId, tickets, details });
  return { actualDeducted: result.data.actualDeducted };
}

export async function clearGachaTickets(userId: string): Promise<{ clearedAmount: number }> {
  const result = await clearGachaTicketsFn({ userId });
  return { clearedAmount: result.data.clearedAmount };
}

export async function bulkGrantGachaTickets(userIds: string[], tickets: number, details?: string): Promise<{ successCount: number; totalCount: number; message: string; errors?: string[] }> {
  const result = await bulkGrantGachaTicketsFn({ userIds, tickets, details });
  return result.data;
}

export async function bulkDeductGachaTickets(userIds: string[], tickets: number, details?: string): Promise<{ successCount: number; totalCount: number; totalDeducted: number; message: string; errors?: string[] }> {
  const result = await bulkDeductGachaTicketsFn({ userIds, tickets, details });
  return result.data;
}

interface TicketHistory {
  userId: string;
  tickets: number;
  reason: string;
  details: string;
  grantedBy?: string;
  createdAt: { seconds: number };
}

export async function getTicketHistory(
  userId: string,
  limitCount: number = 50
): Promise<Array<TicketHistory & { id: string }>> {
  const q = query(
    collection(db, 'ticketHistory'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  const history: Array<TicketHistory & { id: string }> = [];

  querySnapshot.forEach((docSnap) => {
    history.push({
      id: docSnap.id,
      ...docSnap.data() as TicketHistory,
    });
  });

  return history;
}
