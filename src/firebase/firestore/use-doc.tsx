
'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot, DocumentReference } from 'firebase/firestore';

export function useDoc<T = any>(docRef: DocumentReference | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docRef) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setData(snapshot.exists() ? (snapshot.data() as T) : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [docRef?.path]);

  return { data, loading, error };
}
