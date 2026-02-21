
'use client';

import { useState, useEffect, useRef } from 'react';
import { Query, onSnapshot } from 'firebase/firestore';

/**
 * Hook para suscribirse a una colección o consulta de Firestore.
 * Incluye protecciones contra bucles infinitos de renderizado.
 */
export function useCollection<T = any>(query: Query | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dataRef = useRef<string>('');

  useEffect(() => {
    if (!query) {
      if (loading) setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);
        const dataString = JSON.stringify(newData);
        
        // Solo actualizamos el estado si los datos han cambiado realmente
        if (dataString !== dataRef.current) {
          dataRef.current = dataString;
          setData(newData);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [query]); // query debe ser estable (usar useMemoFirebase)

  return { data, loading, error };
}
