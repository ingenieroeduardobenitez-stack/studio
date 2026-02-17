
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

/**
 * Inicializa los servicios de Firebase de forma segura.
 * Verifica si la configuración es válida antes de intentar conectar.
 */
export function initializeFirebase() {
  try {
    const isConfigValid = firebaseConfig.apiKey && 
                          firebaseConfig.apiKey !== "undefined" && 
                          firebaseConfig.apiKey.length > 10;

    if (!isConfigValid) {
      console.warn("Firebase: Configuración no válida. Por favor, configura tu API Key en Firebase Studio.");
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

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
