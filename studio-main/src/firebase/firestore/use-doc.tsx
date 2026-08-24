'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  loading: boolean;         // Alias for compatibility.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to fetch or subscribe to a single Firestore document.
 * Supports an optional 'once' mode to fetch data only once instead of real-time.
 */
export function useDoc<T = any>(
  memoizedDocRef: (DocumentReference<DocumentData> & {__memo?: boolean}) | null | undefined,
  options?: { once?: boolean }
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedDocRef);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // MODO CARGA ÚNICA (Ahorro de recursos)
    if (options?.once) {
      import('firebase/firestore').then(({ getDoc }) => {
        getDoc(memoizedDocRef)
          .then((snapshot) => {
            if (snapshot.exists()) {
              setData({ ...(snapshot.data() as T), id: snapshot.id });
            } else {
              setData(null);
            }
            setIsLoading(false);
          })
          .catch((err: FirestoreError) => {
            const contextualError = new FirestorePermissionError({
              operation: 'get',
              path: memoizedDocRef.path,
            });
            setError(contextualError);
            setIsLoading(false);
            errorEmitter.emit('permission-error', contextualError);
          });
      });
      return;
    }

    // MODO TIEMPO REAL (onSnapshot)
    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        setError(null);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        })

        setError(contextualError)
        setData(null)
        setIsLoading(false)
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, options?.once]);

  if(memoizedDocRef && !memoizedDocRef.__memo && process.env.NODE_ENV === 'development') {
     console.warn(memoizedDocRef + ' was not properly memoized using useMemoFirebase. This can cause redundant reads or infinite loops with { once: true }.');
  }

  const actualLoading = isLoading || (!!memoizedDocRef && data === null);

  return { 
    data, 
    isLoading: actualLoading, 
    loading: actualLoading, 
    error 
  };
}
