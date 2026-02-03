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
 * Hook to fetch and subscribe to class points in real-time
 * @param classId - Class ID (e.g., "1-A", "2-B")
 * @returns Class data with real-time updates
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

    setLoading(true);
    setError(null);

    const classDocRef = doc(db, 'classes', classId);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      classDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setClassData({ id: docSnap.id, ...docSnap.data() } as Class);
        } else {
          setClassData(null);
          setError('クラスデータが見つかりません');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching class data:', err);
        setError('クラスデータの取得に失敗しました');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [classId]);

  return {
    classData,
    loading,
    error,
  };
}
