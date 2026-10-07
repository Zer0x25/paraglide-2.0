import { useEffect, useRef } from 'react';

/**
 * Ref + IntersectionObserver para scroll infinito on-demand de reservas.
 * Extraído de `useReservasController` para evitar que el `RefObject`
 * contamine el objeto retornado por el controller (react-hooks/refs taint).
 */
export function useReservasSentinel(opts: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loading: boolean;
  fetchNextPage: () => void;
}) {
  const { hasNextPage, isFetchingNextPage, loading, fetchNextPage } = opts;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage && !loading) {
        fetchNextPage();
      }
    });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, loading, fetchNextPage]);

  return sentinelRef;
}
