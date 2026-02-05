import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase';
import app from './firebase';
import type { Survey, SurveyCategory, Answer } from '../types/firestore';

const functions = getFunctions(app);

const submitSurveyResponseFn = httpsCallable<
  { surveyId: string; answers: Answer[] },
  { success: boolean; pointsAwarded: number; message: string }
>(functions, 'submitSurveyResponse');

// Check if user has already answered a survey
export async function checkAlreadyAnswered(
  userId: string,
  surveyId: string
): Promise<boolean> {
  const q = query(
    collection(db, 'surveyResponses'),
    where('userId', '==', userId),
    where('surveyId', '==', surveyId)
  );

  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

// Get surveys by category with user's answered status
export async function getSurveysByCategory(
  category: SurveyCategory,
  userId: string
): Promise<Array<Survey & { id: string; isAnswered: boolean }>> {
  // Get active surveys in this category
  const surveysQuery = query(
    collection(db, 'surveys'),
    where('status', '==', 'active'),
    where('category', '==', category),
    orderBy('createdAt', 'desc')
  );

  const surveysSnapshot = await getDocs(surveysQuery);

  // Get user's responses
  const responsesQuery = query(
    collection(db, 'surveyResponses'),
    where('userId', '==', userId)
  );
  const responsesSnapshot = await getDocs(responsesQuery);
  const answeredSurveyIds = new Set(
    responsesSnapshot.docs.map((doc) => doc.data().surveyId)
  );

  const surveys: Array<Survey & { id: string; isAnswered: boolean }> = [];

  surveysSnapshot.forEach((docSnap) => {
    const data = docSnap.data() as Survey;
    surveys.push({
      id: docSnap.id,
      ...data,
      isAnswered: answeredSurveyIds.has(docSnap.id),
    });
  });

  return surveys;
}

// Get a single survey by ID
export async function getSurveyById(
  surveyId: string
): Promise<(Survey & { id: string }) | null> {
  const docSnap = await getDoc(doc(db, 'surveys', surveyId));
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data() as Survey,
  };
}

// Submit survey response and award points via Cloud Functions
export async function submitSurveyResponse(
  _userId: string,
  surveyId: string,
  answers: Answer[],
  _points: number
): Promise<{ success: boolean; message: string; pointsAwarded?: number }> {
  try {
    const result = await submitSurveyResponseFn({ surveyId, answers });
    return result.data;
  } catch (error: unknown) {
    console.error('Error submitting survey response:', error);
    const firebaseError = error as { code?: string; message?: string };
    if (firebaseError.code === 'functions/already-exists') {
      return { success: false, message: 'このアンケートは既に回答済みです' };
    }
    return { success: false, message: '回答の送信に失敗しました' };
  }
}

// Get all surveys (for listing, including closed ones)
export async function getAllSurveysForUser(
  userId: string
): Promise<Array<Survey & { id: string; isAnswered: boolean }>> {
  const surveysQuery = query(
    collection(db, 'surveys'),
    orderBy('createdAt', 'desc')
  );

  const surveysSnapshot = await getDocs(surveysQuery);

  // Get user's responses
  const responsesQuery = query(
    collection(db, 'surveyResponses'),
    where('userId', '==', userId)
  );
  const responsesSnapshot = await getDocs(responsesQuery);
  const answeredSurveyIds = new Set(
    responsesSnapshot.docs.map((doc) => doc.data().surveyId)
  );

  const surveys: Array<Survey & { id: string; isAnswered: boolean }> = [];

  surveysSnapshot.forEach((docSnap) => {
    const data = docSnap.data() as Survey;
    surveys.push({
      id: docSnap.id,
      ...data,
      isAnswered: answeredSurveyIds.has(docSnap.id),
    });
  });

  return surveys;
}
