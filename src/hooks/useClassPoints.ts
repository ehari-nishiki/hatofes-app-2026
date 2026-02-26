import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Class } from '../types/firestore';

interface UseClassPointsResult {
  classData: Class | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch class points data (one-time fetch, optimized for cost reduction)
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

    const fetchClassData = async () => {
      setLoading(true);
      setError(null);

      try {
        const classDocRef = doc(db, 'classes', classId);
        const classDocSnap = await getDoc(classDocRef);

        if (classDocSnap.exists()) {
          setClassData({ id: classDocSnap.id, ...classDocSnap.data() } as Class);
        } else {
          setClassData(null);
          setError('クラスデータが見つかりません');
        }
      } catch (err) {
        console.error('Error fetching class data:', err);
        setError('クラスデータの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchClassData();
  }, [classId]);

  return {
    classData,
    loading,
    error,
  };
}
