'use client';

import { useState, useEffect, useRef } from 'react';
import { onSnapshot, DocumentReference } from 'firebase/firestore';

/**
 * Hook robusto para suscribirse a un documento de Firestore.
 */
export function useDoc<T = any>(docRef: DocumentReference | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const dataRef = useRef<string>('');

  useEffect(() => {
    if (!docRef) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const docData = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
        const dataString = JSON.stringify(docData);

        if (dataString !== dataRef.current) {
          dataRef.current = dataString;
          setData(docData);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore useDoc Error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docRef]);

  return { data, loading, error };
}
