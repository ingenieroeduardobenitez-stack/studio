'use client';

import { useState, useEffect, useRef } from 'react';
import { Query, onSnapshot } from 'firebase/firestore';

export function useCollection<T = any>(query: Query | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dataRef = useRef<string>('');

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);
        const dataString = JSON.stringify(newData);
        
        // Evitar actualizaciones de estado si los datos son idénticos para prevenir bucles
        if (dataString !== dataRef.current) {
          setData(newData);
          dataRef.current = dataString;
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [query]);

  return { data, loading, error };
}
