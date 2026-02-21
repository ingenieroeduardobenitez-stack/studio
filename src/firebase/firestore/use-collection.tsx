'use client';

import { useState, useEffect, useRef } from 'react';
import { Query, onSnapshot } from 'firebase/firestore';

/**
 * Hook robusto para suscribirse a colecciones de Firestore.
 * Evita actualizaciones de estado redundantes comparando los datos serializados.
 */
export function useCollection<T = any>(query: Query | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const dataRef = useRef<string>('');
  const queryRef = useRef<string>('');

  useEffect(() => {
    // Generamos una clave para la consulta actual
    const currentQueryKey = query ? JSON.stringify(query.toString()) : '';
    
    // Si no hay consulta o cambió, reiniciamos el estado de carga
    if (!query) {
      setLoading(false);
      setData([]);
      dataRef.current = '';
      queryRef.current = '';
      return;
    }

    if (currentQueryKey !== queryRef.current) {
      setLoading(true);
      queryRef.current = currentQueryKey;
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);
        const dataString = JSON.stringify(newData);
        
        // Solo actualizamos el estado si los datos realmente cambiaron
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

    // Al desmontar o cambiar la consulta, nos desuscribimos
    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
