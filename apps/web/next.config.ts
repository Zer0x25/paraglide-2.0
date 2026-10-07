import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";
import dotenv from "dotenv";
import path from "path";

// Workspace commands run from apps/web, so load the shared root environment file explicitly.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development" && process.env.ENABLE_PWA_DEV !== "true",
  // ADR 009: fallback offline para navegación a rutas no cacheadas sin red.
  // /~offline es una ruta pública estática garantizada (código 200) que el Service
  // Worker puede precachear sin problemas de cookies/redirecciones de middleware.
  fallbacks: {
    document: "/~offline",
  },
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      // Excluir SSE (/api/eventos) de cualquier timeout o caché de Workbox
      {
        urlPattern: ({ sameOrigin, url: { pathname } }) =>
          sameOrigin && pathname.startsWith("/api/eventos"),
        handler: "NetworkOnly",
      },
      // Reemplaza la entrada por defecto "cross-origin" de next-pwa (NetworkFirst).
      // Ese default intercepta peticiones de terceros (p.ej. el beacon de Cloudflare
      // Insights) y, si fallan, lanza "no-response" sin manejar. Aquí solo pasamos a
      // red y, ante error, respondemos 504 en vez de lanzar una promesa sin manejar.
      {
        urlPattern: ({ sameOrigin }) => !sameOrigin,
        handler: async ({ request }) => {
          try {
            return await fetch(request);
          } catch {
            return new Response(null, { status: 504, statusText: "offline" });
          }
        },
        options: { cacheName: "cross-origin" },
      },
      // Soporte offline para peticiones de prefetch RSC (Next.js App Router).
      // Unifica el cacheName con 'pages-rsc' e ignora search params (?_rsc=...) para
      // que el prefetch en warmup sirva de inmediato a la navegación activa.
      {
        urlPattern: ({ request, url: { pathname }, sameOrigin }) =>
          sameOrigin &&
          !pathname.startsWith("/api/") &&
          request.headers.get("RSC") === "1" &&
          request.headers.get("Next-Router-Prefetch") === "1",
        handler: "NetworkFirst",
        options: {
          cacheName: "pages-rsc",
          matchOptions: {
            ignoreSearch: true,
            ignoreVary: true,
          },
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 86400 * 7, // 7 días alineado con IndexedDB
          },
          networkTimeoutSeconds: 3,
          plugins: [
            {
              cacheWillUpdate: async ({ response }: { response: Response }) => {
                if (!response) return null;
                if (response.type === 'opaqueredirect' || response.status === 307 || response.status === 308) {
                  return new Response(response.body, {
                    status: 200,
                    statusText: 'OK',
                    headers: response.headers,
                  });
                }
                if (response.status !== 200) return null;
                const headers = new Headers(response.headers);
                headers.delete('vary');
                return new Response(response.body, {
                  status: response.status,
                  statusText: response.statusText,
                  headers,
                });
              },
            },
          ],
        },
      },
      // Soporte offline para navegación React Server Components (RSC) en App Router.
      {
        urlPattern: ({ request, url: { pathname }, sameOrigin }) =>
          sameOrigin &&
          !pathname.startsWith("/api/") &&
          request.headers.get("RSC") === "1",
        handler: "NetworkFirst",
        options: {
          cacheName: "pages-rsc",
          matchOptions: {
            ignoreSearch: true,
            ignoreVary: true,
          },
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 86400 * 7,
          },
          networkTimeoutSeconds: 3,
          plugins: [
            {
              cacheWillUpdate: async ({ response }: { response: Response }) => {
                if (!response) return null;
                if (response.type === 'opaqueredirect' || response.status === 307 || response.status === 308) {
                  return new Response(response.body, {
                    status: 200,
                    statusText: 'OK',
                    headers: response.headers,
                  });
                }
                if (response.status !== 200) return null;
                const headers = new Headers(response.headers);
                headers.delete('vary');
                return new Response(response.body, {
                  status: response.status,
                  statusText: response.statusText,
                  headers,
                });
              },
            },
          ],
        },
      },
      // Soporte offline para documentos HTML / navegación directa de páginas
      {
        urlPattern: ({ request, url: { pathname }, sameOrigin }) =>
          sameOrigin &&
          !pathname.startsWith("/api/") &&
          !pathname.startsWith("/_next/") &&
          !pathname.includes(".") &&
          request.headers.get("RSC") !== "1",
        handler: "NetworkFirst",
        options: {
          cacheName: "pages",
          matchOptions: {
            ignoreSearch: true,
            ignoreVary: true,
          },
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 86400 * 7,
          },
          networkTimeoutSeconds: 3,
          plugins: [
            {
              cacheWillUpdate: async ({ response }: { response: Response }) => {
                if (!response) return null;
                if (response.type === 'opaqueredirect' || response.status === 307 || response.status === 308) {
                  return new Response(response.body, {
                    status: 200,
                    statusText: 'OK',
                    headers: response.headers,
                  });
                }
                if (response.status !== 200) return null;
                const headers = new Headers(response.headers);
                headers.delete('vary');
                return new Response(response.body, {
                  status: response.status,
                  statusText: response.statusText,
                  headers,
                });
              },
            },
          ],
        },
      },
    ],
  },
});

// Fallback amplio para dev: LAN + Tailscale. Sobrescribible vía .env ALLOWED_DEV_ORIGINS.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || 'localhost,10.*.*.*,192.168.*.*,172.*.*.*,100.*.*.*,*.ts.net,*.tailscale.net')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  turbopack: {},
  // Standalone: genera un server autocontenido (.next/standalone) con un
  // node_modules mínimo trazado. La imagen Docker de producción arranca con
  // `node server.js` en vez de `next start`, reduciendo drásticamente el tamaño.
  output: 'standalone',
  allowedDevOrigins,
  async rewrites() {
    const apiHost = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiHost}/api/:path*`
      }
    ];
  },
  // El stream SSE (/api/eventos) pasa por el proxy de rewrites en dev.
  // Sin esto, el proxy corta la conexión a los ~30s y el navegador registra
  // ERR_INCOMPLETE_CHUNKED_ENCODING en cada reconexión del EventSource.
  // En producción el tráfico no pasa por este proxy (docker: web → API directa),
  // así que el ajuste es inocuo allí.
  experimental: {
    proxyTimeout: 120_000,
  },
};

const pwaConfig = withPWA(nextConfig);

const sentryOptions = {
  org: "parapente-school",
  project: "parapente-web",
  silent: true,
  widenClientFileUpload: true,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(pwaConfig, sentryOptions)
  : pwaConfig;
