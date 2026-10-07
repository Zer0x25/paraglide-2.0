import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import api from '../services/api';

/**
 * Hook de precarga (warmup) de datos operativos y rutas para soporte offline (ADR 009).
 *
 * Al iniciar la app (o al autenticarse y tener red), realiza en segundo plano:
 * 1. Prefetch de rutas con Next.js router para poblar la caché RSC del Service Worker.
 * 2. Prefetch de datos operativos de una ventana de ±15 días (mes en curso y colindantes):
 *    - Stats del dashboard
 *    - Reservas (activas y generales)
 *    - Vuelos de la vista calendario
 *    - Pilotos (totales y activos)
 *    - Pasajeros
 *    - Configuración y resolución de bloques
 *    - Equipos y plantillas
 *
 * TanStack Query + PersistQueryClientProvider almacenan automáticamente estos
 * datos en IndexedDB. Si el usuario pierde conexión, todas las vistas principales
 * cuentan con datos inmediatos y navegación fluida sin pantallas en blanco ni ERR_FAILED.
 */
export function useWarmupData() {
  const queryClient = useQueryClient();
  const hasRunRef = useRef(false);
  // Hook incondicional (regla de hooks): el try/catch previo lo llamaba de forma
  // condicional y podía desordenar los hooks entre renders.
  const router = useRouter();

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token || typeof window === 'undefined' || !navigator.onLine) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const routes = [
      '/',
      '/pilotos',
      '/reservas',
      '/calendario',
      '/configuracion',
      '/analiticas',
      '/equipos',
      '/plantillas',
      '/reportes',
      '/meteorologia',
      '/pantalla',
      '/auditoria',
      '/admin/users',
      '/admin/modules',
    ];

    const warmup = async () => {
      try {
        // 0. Prefetch de rutas clave con router de Next.js
        if (router) {
          for (const route of routes) {
            try {
              router.prefetch(route);
            } catch {
              // Ignorar errores de prefetch individual
            }
          }
        }

        // Calentamiento activo del Service Worker para soporte offline real:
        // Asegura que el SW esté activo antes de emitir peticiones si está soportado,
        // y ejecuta el calentamiento en lotes para no saturar la red ni la CPU.
        const warmRoutes = async () => {
          if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

          if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            try {
              await navigator.serviceWorker.ready;
              // Si el Service Worker está instalando o activando, esperar a que tome control (clients.claim)
              if (!navigator.serviceWorker.controller) {
                await new Promise<void>((resolve) => {
                  const onController = () => {
                    navigator.serviceWorker.removeEventListener('controllerchange', onController);
                    resolve();
                  };
                  navigator.serviceWorker.addEventListener('controllerchange', onController);
                  setTimeout(resolve, 8000);
                });
              }
            } catch {
              // Si falla o no está disponible, continuar con fetch normal
            }
          }

          const origin = window.location?.origin || '';
          const BATCH_SIZE = 3;
          for (let i = 0; i < routes.length; i += BATCH_SIZE) {
            const batch = routes.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
              batch.flatMap((route) => {
                const targetUrl = origin ? `${origin}${route}` : route;
                const rscTargetUrl = targetUrl.includes('?') ? `${targetUrl}&_rsc` : `${targetUrl}?_rsc`;
                return [
                  // Payload RSC directo con _rsc (evita redirect 307 de Next.js 16 y alimenta pages-rsc)
                  window.fetch(rscTargetUrl, {
                    headers: { RSC: '1' },
                    credentials: 'same-origin',
                  }).then((res) => res.text()).catch(() => {}),
                  // Payload RSC base
                  window.fetch(targetUrl, {
                    headers: { RSC: '1' },
                    credentials: 'same-origin',
                  }).then((res) => res.text()).catch(() => {}),
                  // Documento HTML para recargas directas (F5) o cambio de pestaña
                  window.fetch(targetUrl, {
                    headers: { Accept: 'text/html' },
                    credentials: 'same-origin',
                  }).then((res) => res.text()).catch(() => {}),
                ];
              })
            );
          }
        };

        // Disparar calentamiento de rutas en segundo plano
        warmRoutes().catch(() => {});

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        // Rango del mes actual (cubre holgadamente los ±15 días alrededor de hoy)
        const desde = new Date(year, month, 1);
        const hasta = new Date(year, month + 1, 0, 23, 59, 59);
        const desdeISO = desde.toISOString();
        const hastaISO = hasta.toISOString();

        const resDesdeISO = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
        const resHastaISO = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);

        // 1. Dashboard stats
        queryClient.prefetchQuery({
          queryKey: ['dashboard', 'stats'],
          queryFn: () => api.dashboard.stats(),
          staleTime: 60_000,
        });

        // 2. Pilotos (totales y activos)
        queryClient.prefetchQuery({
          queryKey: ['pilotos'],
          queryFn: async () => (await api.pilotos.listar({ pageSize: 500 })).data,
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['pilotos', 'activos'],
          queryFn: async () => (await api.pilotos.listar({ activo: 'true', pageSize: 500 })).data,
          staleTime: 60_000,
        });

        // 3. Pasajeros
        queryClient.prefetchQuery({
          queryKey: ['pasajeros'],
          queryFn: async () => (await api.pasajeros.listar({ pageSize: 500 })).data,
          staleTime: 60_000,
        });

        // 4. Reservas (colección general y tab PROXIMAS de la lista)
        queryClient.prefetchQuery({
          queryKey: ['reservas'],
          queryFn: async () => (await api.reservas.listar({ pageSize: 500 })).data,
          staleTime: 60_000,
        });

        queryClient.prefetchInfiniteQuery({
          queryKey: ['reservas', { tab: 'PROXIMAS' }],
          queryFn: async () => {
            const params = {
              pageSize: '20',
              desde: new Date().toISOString(),
              sort: 'fechaAgenda.asc',
            };
            return api.reservas.listar(params);
          },
          initialPageParam: undefined,
          staleTime: 60_000,
        });

        // 4. Vuelos del calendario (mes actual / ±15 días)
        queryClient.prefetchQuery({
          queryKey: ['vuelos', 'calendario', desdeISO, hastaISO],
          queryFn: async () =>
            (
              await api.vuelos.listar({
                desde: desdeISO,
                hasta: hastaISO,
                pageSize: 500,
                sort: 'fechaHora.asc',
                campos: 'vista-calendario',
              })
            ).data,
          staleTime: 60_000,
        });

        // 5. Configuración y resolución de bloques
        queryClient.prefetchQuery({
          queryKey: ['configuracion-bloques'],
          queryFn: () => api.configuracion.listar(),
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['configuracion-resolucion', resDesdeISO, resHastaISO],
          queryFn: () => api.configuracion.resolver({ desde: resDesdeISO, hasta: resHastaISO }),
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['configuracion-resolucion', 'pilotos', resDesdeISO, resHastaISO],
          queryFn: () => api.configuracion.resolver({ desde: resDesdeISO, hasta: resHastaISO }),
          staleTime: 60_000,
        });

        // 6. Tarifas, promociones, reglas y configuración operativa
        queryClient.prefetchQuery({
          queryKey: ['tarifas'],
          queryFn: () => api.tarifas.listar(),
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['promociones'],
          queryFn: () => api.promociones.listar(),
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['reglas-operativas'],
          queryFn: () => api.reglasOperativas.listar(),
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['deslindes'],
          queryFn: () => api.deslindes.listar(),
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['equipos'],
          queryFn: async () => (await api.equipos.listar({ pageSize: 500 })).data,
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['plantillas'],
          queryFn: async () => (await api.plantillas.listar({ pageSize: 500 })).data,
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['empresa'],
          queryFn: () => api.empresa.obtener(),
          staleTime: 60_000,
        });

        queryClient.prefetchQuery({
          queryKey: ['faqs'],
          queryFn: () => api.faqs.listar(),
          staleTime: 60_000,
        });
      } catch {
        // En segundo plano: los fallos no interrumpen la navegación
      }
    };

    // Ejecutar warmup inicial y escuchar reconexión
    warmup();

    const handleOnline = () => {
      warmup();
    };

    const handleControllerChange = () => {
      warmup();
    };

    window.addEventListener('online', handleOnline);
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }
    return () => {
      window.removeEventListener('online', handleOnline);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
    };
  }, [queryClient, router]);
}
