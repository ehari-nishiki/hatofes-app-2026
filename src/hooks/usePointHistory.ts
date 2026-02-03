import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  QueryDocumentSnapshot,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PointHistory } from '../types/firestore';

const ITEMS_PER_PAGE = 20;

interface UsePointHistoryResult {
  history: PointHistory[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

/**
 * Hook to fetch and manage point history for a user
 * @param userId - User ID to fetch history for
 * @returns Point history data and pagination functions
 */
export function usePointHistory(userId: string | null): UsePointHistoryResult {
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);

  // Initial load with real-time listener
  useEffect(() => {
    if (!userId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const pointHistoryRef = collection(db, 'pointHistory');
    const q = query(
      pointHistoryRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(ITEMS_PER_PAGE)
    );

    // Set up real-time listener for initial page
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const historyData: PointHistory[] = [];
        snapshot.forEach((doc) => {
          historyData.push({ id: doc.id, ...doc.data() } as PointHistory);
        });

        setHistory(historyData);
        setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching point history:', err);
        setError('ポイント履歴の取得に失敗しました');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Load more function (pagination)
  const loadMore = async () => {
    if (!userId || !lastDoc || !hasMore) return;

    try {
      const pointHistoryRef = collection(db, 'pointHistory');
      const q = query(
        pointHistoryRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(ITEMS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const moreHistory: PointHistory[] = [];
      snapshot.forEach((doc) => {
        moreHistory.push({ id: doc.id, ...doc.data() } as PointHistory);
      });

      setHistory((prev) => [...prev, ...moreHistory]);
      setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
    } catch (err) {
      console.error('Error loading more history:', err);
      setError('追加の履歴の取得に失敗しました');
    }
  };

  return {
    history,
    loading,
    error,
    hasMore,
    loadMore,
  };
}
