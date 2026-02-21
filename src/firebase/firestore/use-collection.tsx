
'use client';

import { useState, useEffect, useRef } from 'react';
import { Query, onSnapshot } from 'firebase/firestore';

/**
 * Hook para suscribirse a una colección o consulta de Firestore.
 * Incluye protecciones robustas contra bucles infinitos de renderizado.
 */
export function useCollection<T = any>(query: Query | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dataRef = useRef<string>('');
  const activeQueryRef = useRef<Query | null>(null);

  useEffect(() => {
    // Si la consulta no ha cambiado realmente (referencia estable), no reiniciamos el efecto
    if (!query) {
      if (loading) setLoading(false);
      return;
    }

    if (activeQueryRef.current === query) return;
    activeQueryRef.current = query;

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);
        const dataString = JSON.stringify(newData);
        
        // Solo actualizamos el estado si los datos han cambiado profundamente
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

    return () => {
      activeQueryRef.current = null;
      unsubscribe();
    };
  }, [query]); // query debe ser estable (usar useMemoFirebase)

  return { data, loading, error };
}
