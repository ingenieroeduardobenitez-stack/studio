'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { useMemo, useRef } from 'react';

/**
 * Inicializa los servicios de Firebase de forma segura.
 */
export function initializeFirebase() {
  try {
    const isConfigValid = firebaseConfig.apiKey && 
                          firebaseConfig.apiKey !== "undefined" && 
                          firebaseConfig.apiKey.length > 10;

    if (!isConfigValid) {
      return { 
        app: null as unknown as FirebaseApp, 
        auth: null as unknown as Auth, 
        firestore: null as unknown as Firestore 
      };
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    
    return { app, auth, firestore };
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
    return { 
      app: null as unknown as FirebaseApp, 
      auth: null as unknown as Auth, 
      firestore: null as unknown as Firestore 
    };
  }
}

/**
 * Hook especializado para memoizar referencias o consultas de Firebase.
 * Garantiza la estabilidad del objeto incluso si el componente se re-renderiza,
 * evitando bucles infinitos en useCollection o useDoc.
 */
export function useMemoFirebase<T>(factory: () => T, deps: any[]): T {
  const ref = useRef<T | null>(null);
  const depsRef = useRef<any[]>([]);

  const depsChanged = deps.length !== depsRef.current.length || 
                      deps.some((dep, i) => dep !== depsRef.current[i]);

  if (depsChanged) {
    ref.current = factory();
    depsRef.current = deps;
  }

  return ref.current as T;
}

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
