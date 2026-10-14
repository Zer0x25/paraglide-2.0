import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import api from '../services/api';
import { listOutbox } from '../services/outbox/outbox.service';

/**
 * Hook de precarga (warmup) de datos operativos y rutas para soporte offline (ADR 009).
 *
 * Al iniciar la app (o al autenticarse y tener red), realiza en segundo plano:
 * 1. Espera a que el Outbox offline drene cualquier mutación pendiente antes de
 *    consumir ancho de banda en conexiones móviles (3G/4G en pista).
 * 2. Prefetch de rutas con Next.js router (filtradas por rol del usuario) para poblar la caché RSC del Service Worker.
 * 3. Prefetch de datos operativos de una ventana de ±15 días (mes en curso y colindantes).
 */
export function useWarmupData() {
  const queryClient = useQueryClient();
  const hasRunRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token || typeof window === 'undefined' || !navigator.onLine) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    let userRole = 'ADMIN';
    try {
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.role) userRole = String(parsed.role);
      }
    } catch {
      // Fallback a lista estándar si no se puede leer el rol
    }

    const baseRoutes = ['/', '/pilotos', '/reservas', '/calendario', '/meteorologia', '/pantalla'];
    const recepcionOrAdminRoutes = ['/configuracion', '/equipos', '/plantillas', '/reportes'];
    const adminOnlyRoutes = ['/analiticas', '/auditoria', '/admin/users', '/admin/modules'];

    const routes =
      userRole === 'PILOTO'
        ? baseRoutes
        : userRole === 'RECEPCION'
          ? [...baseRoutes, ...recepcionOrAdminRoutes]
          : [...baseRoutes, ...recepcionOrAdminRoutes, ...adminOnlyRoutes];

    const waitForOutboxDrain = async () => {
      try {
        for (let attempt = 0; attempt < 10; attempt++) {
          const pending = await listOutbox();
          if (!pending || pending.length === 0) break;
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch {
        // Si IndexedDB no está disponible en test, continuar sin bloquear
      }
    };

    const warmup = async () => {
      try {
        // Prioridad absoluta a la sincronización de mutaciones pendientes en cola offline
        await waitForOutboxDrain();

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
        // Ejecuta en lotes pequeños (BATCH_SIZE = 2) para no saturar enlaces móviles en pista.
        const warmRoutes = async () => {
          if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

          if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            try {
              await navigator.serviceWorker.ready;
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
          const BATCH_SIZE = 2;
          for (let i = 0; i < routes.length; i += BATCH_SIZE) {
            const batch = routes.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
              batch.flatMap((route) => {
                const targetUrl = origin ? `${origin}${route}` : route;
                const rscTargetUrl = targetUrl.includes('?')
                  ? `${targetUrl}&_rsc`
                  : `${targetUrl}?_rsc`;
                return [
                  window
                    .fetch(rscTargetUrl, {
                      headers: { RSC: '1' },
                      credentials: 'same-origin',
                    })
                    .then((res) => res.text())
                    .catch(() => {}),
                  window
                    .fetch(targetUrl, {
                      headers: { Accept: 'text/html' },
                      credentials: 'same-origin',
                    })
                    .then((res) => res.text())
                    .catch(() => {}),
                ];
              }),
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

        const isRecepcionOrAdmin = userRole === 'ADMIN' || userRole === 'RECEPCION';
        const isAdmin = userRole === 'ADMIN';

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

        if (isRecepcionOrAdmin) {
          // 3. Pasajeros (solo RECEPCION / ADMIN)
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
        }

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

        // 6. Tarifas, promociones, reglas y configuración operativa (RECEPCION / ADMIN)
        if (isRecepcionOrAdmin) {
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
        }

        if (isAdmin) {
          queryClient.prefetchQuery({
            queryKey: ['deslindes'],
            queryFn: () => api.deslindes.listar(),
            staleTime: 60_000,
          });
        }
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
