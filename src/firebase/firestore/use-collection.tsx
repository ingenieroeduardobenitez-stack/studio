
'use client';

import { useState, useEffect, useRef } from 'react';
import { Query, onSnapshot } from 'firebase/firestore';

/**
 * Hook robusto para suscribirse a colecciones de Firestore.
 * Evita bucles infinitos comparando los datos serializados antes de actualizar el estado.
 */
export function useCollection<T = any>(query: Query | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const dataRef = useRef<string>('');
  const queryRef = useRef<string>('');

  useEffect(() => {
    if (!query) {
      setLoading(false);
      setData([]);
      return;
    }

    // Evitar re-suscripciones si la consulta es idéntica (basado en el path interno si es posible)
    const currentQueryKey = JSON.stringify((query as any)._query || query.toString());
    if (queryRef.current === currentQueryKey) return;
    queryRef.current = currentQueryKey;

    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);
        const dataString = JSON.stringify(newData);
        
        if (dataString !== dataRef.current) {
          dataRef.current = dataString;
          setData(newData);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore useCollection Error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
