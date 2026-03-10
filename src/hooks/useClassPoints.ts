import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Class } from '../types/firestore';

interface UseClassPointsResult {
  classData: Class | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch class points data in realtime.
 * @param classId - Class ID (e.g., "1-A", "2-B")
 * @returns Class data (fetched once on mount)
 */
export function useClassPoints(classId: string | null): UseClassPointsResult {
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) {
      setClassData(null);
      setLoading(false);
      return;
    }

    const classDocRef = doc(db, 'classes', classId);
    const unsubscribe = onSnapshot(classDocRef, (classDocSnap) => {
      setLoading(true);
      setError(null);
      if (classDocSnap.exists()) {
        setClassData({ id: classDocSnap.id, ...classDocSnap.data() } as Class);
      } else {
        setClassData(null);
        setError('クラスデータが見つかりません');
      }
      setLoading(false);
    }, (err) => {
      console.error('Error fetching class data:', err);
      setError('クラスデータの取得に失敗しました');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [classId]);

  return {
    classData,
    loading,
    error,
  };
}
