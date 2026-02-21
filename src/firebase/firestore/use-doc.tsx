
'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, DocumentReference } from 'firebase/firestore';

/**
 * Hook para suscribirse a un documento de Firestore.
 * Protege contra re-renderizados infinitos comparando los datos serializados.
 */
export function useDoc<T = any>(docRef: DocumentReference | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dataRef = useRef<string>('');

  useEffect(() => {
    if (!docRef) {
      if (loading) setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const docData = snapshot.exists() ? (snapshot.data() as T) : null;
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

    return unsubscribe;
  }, [docRef?.path]);

  return { data, loading, error };
}
