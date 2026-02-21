
'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

interface FirebaseContextType {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ 
  children, 
  app, 
  auth, 
  firestore 
}: { 
  children: ReactNode; 
  app: FirebaseApp; 
  auth: Auth; 
  firestore: Firestore;
}) {
  // Memoize the value to prevent unnecessary re-renders in consumers
  const value = useMemo(() => {
    if (!app || !auth || !firestore) return undefined;
    return { app, auth, firestore };
  }, [app, auth, firestore]);
  
  if (!value) return <>{children}</>;

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirebase must be used within FirebaseProvider');
  return context;
}

export const useFirebaseApp = () => useFirebase().app;
export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().firestore;
