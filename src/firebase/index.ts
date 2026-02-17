
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

/**
 * Inicializa los servicios de Firebase de forma segura.
 * Si falta la configuración, captura el error para evitar que la aplicación se detenga.
 */
export function initializeFirebase() {
  try {
    // Verificamos si existe una configuración básica para evitar errores del SDK
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "undefined") {
      console.warn("Firebase: La API Key no está configurada. Verifica las variables de entorno.");
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    return { app, auth, firestore };
  } catch (error) {
    console.error("Error crítico al inicializar Firebase:", error);
    // Retornamos servicios nulos para que la app pueda renderizar el resto de componentes
    // y mostrar mensajes de error contextuales en lugar de un crash blanco.
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
