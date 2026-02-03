import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { Class } from '../types/firestore';

/**
 * Generate class ID from grade and class
 * @param grade - Grade number (1-3)
 * @param className - Class name (A-H)
 * @returns Class ID (e.g., "1-A", "2-B")
 */
export function generateClassId(grade: number, className: string): string {
  return `${grade}-${className}`;
}

/**
 * Get class data from Firestore
 * @param classId - Class ID (e.g., "1-A")
 * @returns Class data or null if not found
 */
export async function getClassData(classId: string): Promise<Class | null> {
  try {
    const classDocRef = doc(db, 'classes', classId);
    const classDocSnap = await getDoc(classDocRef);

    if (classDocSnap.exists()) {
      return classDocSnap.data() as Class;
    }
    return null;
  } catch (error) {
    console.error('Error fetching class data:', error);
    return null;
  }
}

/**
 * Get top classes by points
 * @param limitCount - Number of classes to fetch
 * @returns Array of class data with IDs
 */
export async function getTopClasses(limitCount: number = 10): Promise<Array<Class & { id: string }>> {
  try {
    const classesRef = collection(db, 'classes');
    const q = query(classesRef, orderBy('totalPoints', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);

    const classes: Array<Class & { id: string }> = [];
    querySnapshot.forEach((doc) => {
      classes.push({
        id: doc.id,
        ...doc.data() as Class,
      });
    });

    return classes;
  } catch (error) {
    console.error('Error fetching top classes:', error);
    return [];
  }
}

/**
 * Parse class ID into grade and class name
 * @param classId - Class ID (e.g., "1-A")
 * @returns Object with grade and className
 */
export function parseClassId(classId: string): { grade: number; className: string } | null {
  const match = classId.match(/^(\d)-([A-H])$/);
  if (!match) return null;

  return {
    grade: parseInt(match[1]),
    className: match[2],
  };
}
