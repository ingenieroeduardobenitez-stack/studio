
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

/**
 * Inicializa los servicios de Firebase de forma segura.
 * Si falta la configuración o es inválida, captura el error para evitar que la aplicación se detenga.
 */
export function initializeFirebase() {
  try {
    // Verificamos si la configuración es mínima y válida
    const isConfigValid = firebaseConfig.apiKey && 
                          firebaseConfig.apiKey !== "undefined" && 
                          firebaseConfig.apiKey.length > 10;

    if (!isConfigValid) {
      console.warn("Firebase: Configuración no válida o incompleta detectada.");
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
    console.error("Error crítico al inicializar Firebase:", error);
    // Retornamos servicios nulos para que la app pueda renderizar el resto de componentes
    // y mostrar mensajes de aviso en lugar de un crash completo.
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
