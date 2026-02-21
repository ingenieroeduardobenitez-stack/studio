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

  useEffect(() => {
    // Si no hay consulta, terminamos la carga y limpiamos datos
    if (!query) {
      setLoading(false);
      setData([]);
      return;
    }

    // Iniciamos la carga al suscribirnos
    setLoading(true);

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
