import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { User } from '../types/firestore';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
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

  // Validate email domain
  const isValidDomain = (email: string): boolean => {
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
      if (user && isValidDomain(user.email || '')) {
        setCurrentUser(user);
      } else if (user && !isValidDomain(user.email || '')) {
        // Invalid domain, sign out
        console.error('Invalid email domain');
        await firebaseSignOut(auth);
        setCurrentUser(null);
        setUserData(null);
      } else {
        setCurrentUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Listen to user data changes in Firestore (real-time updates)
  useEffect(() => {
    if (!currentUser) {
      setUserData(null);
      return;
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data() as User);
        } else {
          setUserData(null);
        }
      },
      (error) => {
        console.error('Error listening to user data:', error);
        setUserData(null);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    signOut,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
