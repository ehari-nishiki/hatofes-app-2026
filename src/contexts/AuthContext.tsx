import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { User } from '../types/firestore';
import { logAuthError } from '../lib/authErrors';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  userDataLoading: boolean;
  userDataChecked: boolean; // true after first check is complete
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [userDataChecked, setUserDataChecked] = useState(false);

  const isValidDomain = (email: string): boolean => {
    if (import.meta.env.VITE_RESTRICT_DOMAIN !== 'true') return true;
    return email.endsWith('@g.nagano-c.ed.jp');
  };

  // Refresh user data from Firestore
  const refreshUserData = async () => {
    if (!currentUser) {
      setUserData(null);
      return;
    }

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        setUserData(userDocSnap.data() as User);
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(null);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUserData(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // リダイレクト処理中は待機
      const isRedirectProcessing = sessionStorage.getItem('redirect_processing') === 'true'
      if (isRedirectProcessing) {
        console.log('[AuthContext] Redirect in progress, deferring auth state update')
        return
      }

      if (user && isValidDomain(user.email || '')) {
        // Reset userData loading states synchronously with setCurrentUser
        // so they are batched into the same render. Without this, ProtectedRoute
        // sees stale userDataChecked=true / userDataLoading=false from the
        // previous signed-out state and redirects to /register before the
        // fetch effect has a chance to run.
        setUserData(null);
        setUserDataLoading(true);
        setUserDataChecked(false);
        setCurrentUser(user);
      } else if (user && !isValidDomain(user.email || '')) {
        // Invalid domain, sign out
        console.error('Invalid email domain');
        await logAuthError('AUTH_001', new Error('Invalid email domain'), {
          email: user.email || undefined,
          step: 'auth',
        }, user.uid);
        await firebaseSignOut(auth);
        setCurrentUser(null);
        setUserData(null);
        setUserDataLoading(false);
        setUserDataChecked(true);
      } else {
        setCurrentUser(null);
        setUserData(null);
        setUserDataLoading(false);
        setUserDataChecked(true);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Load user data from Firestore (one-time fetch, not real-time)
  useEffect(() => {
    // Wait for auth to finish loading first
    if (loading) {
      return;
    }

    if (!currentUser) {
      setUserData(null);
      setUserDataLoading(false);
      setUserDataChecked(true);
      return;
    }

    // Reset states when starting to load user data
    setUserDataLoading(true);
    setUserDataChecked(false);

    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data() as User);
        } else {
          setUserData(null);
          await logAuthError('AUTH_003', new Error('User document does not exist'), {
            email: currentUser.email || undefined,
            step: 'firestore',
          }, currentUser.uid);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        await logAuthError('AUTH_002', error, {
          email: currentUser.email || undefined,
          step: 'firestore',
        }, currentUser.uid);
        setUserData(null);
      } finally {
        setUserDataLoading(false);
        setUserDataChecked(true);
      }
    };

    fetchUserData();
  }, [currentUser, loading]);

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    userDataLoading,
    userDataChecked,
    signOut,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
