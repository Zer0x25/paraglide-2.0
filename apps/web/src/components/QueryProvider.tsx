"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { resolveStorage } from '@/services/storage/idbStorage';
import { ReactNode, useEffect, useState } from 'react';

// Pilar 5: TanStack Query reemplaza a SWR. Defaults pensados para esta app:
// - staleTime: los datos se sirven de caché 15s (las mutaciones y el SSE
//   invalidan por queryKey cuando algo cambia).
// - refetchOnWindowFocus false: el SSE de /api/eventos es quien empuja los
//   cambios; revalidar en cada focus dispara peticiones innecesarias.
//
// Pilar 6: persistencia de caché en IndexedDB (asíncrono, sin límite de ~5MB,
// sobrevive recargas). La app muestra datos inmediatamente al recargar (stale)
// mientras revalida en segundo plano. El SW no cachea /api/* (convención ADR 009).
// Excluimos claves sensibles/volátiles del persister.

const EXCLUDED_QUERY_PREFIXES = ['auth', 'vuelos'];

function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const first = queryKey[0];
  if (typeof first !== 'string') return true;
  return !EXCLUDED_QUERY_PREFIXES.includes(first);
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 7 * 24 * 60 * 60 * 1000, // 7 días alineado con maxAge de persistencia (evita purgar queries inactivas de IndexedDB)
        retry: 1,
        refetchOnWindowFocus: false,
        // Al reconectar (online/SSE) se revalida (ADR 007/009).
        refetchOnReconnect: true,
        networkMode: 'offlineFirst',
      },
      mutations: {
        networkMode: 'offlineFirst',
      },
    },
  }));

  // Cleanup one-shot: borra la clave vieja de localStorage de la versión
  // anterior (el buster 'v2-idb' ya invalida, pero evitamos dejar basura).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem('parapente-query-cache');
    } catch {
      // ignore — no crítico
    }
  }, []);

  const [persister] = useState(() => {
    if (typeof window === 'undefined') return undefined;
    return createAsyncStoragePersister({
      storage: resolveStorage(),
      key: 'parapente-query-cache',
      // Only persist queries that pass the filter
      serialize: (data) => {
        const filtered = {
          ...data,
          clientState: {
            ...data.clientState,
            queries: data.clientState.queries.filter((q: { queryKey: readonly unknown[] }) =>
              shouldPersistQuery(q.queryKey),
            ),
          },
        };
        return JSON.stringify(filtered);
      },
      deserialize: (data) => JSON.parse(data),
    });
  });

  // SSR or no persister available — use standard provider
  if (!persister) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days max cache age
        buster: 'v3-no-vuelos', // v3: invalida caché con vuelos fantasma (unique+soft-delete) y excluye vuelos del persister
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            shouldPersistQuery(query.queryKey) &&
            (query.state.status === 'success' || query.state.data !== undefined),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}