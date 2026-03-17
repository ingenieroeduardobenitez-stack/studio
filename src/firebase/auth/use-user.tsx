'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../provider';

/**
 * Hook simple para obtener el usuario actual.
 * Nota: Se prefiere usar useUser() de @/firebase (que viene de provider.tsx) 
 * por consistencia con el contexto global.
 */
export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsUserLoading(false);
    });
  }, [auth]);

  return { user, isUserLoading, loading: isUserLoading };
}
