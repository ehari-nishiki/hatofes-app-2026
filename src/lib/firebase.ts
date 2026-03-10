import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Set persistence to LOCAL to ensure auth state persists across redirects (critical for mobile)
// Falls back to SESSION storage if LOCAL is blocked (e.g., Private Browsing mode)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('Failed to set auth persistence (Private Browsing?):', error);
  // Private Browsing時はsessionStorageにフォールバック
  setPersistence(auth, browserSessionPersistence).catch((fallbackError) => {
    console.error('Failed to set session persistence:', fallbackError);
  });
});

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Functions
export const functions = getFunctions(app);

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
if (import.meta.env.VITE_RESTRICT_DOMAIN === 'true') {
  googleProvider.setCustomParameters({ hd: 'g.nagano-c.ed.jp' });
}

export default app;
