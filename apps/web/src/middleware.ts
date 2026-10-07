import { NextRequest, NextResponse } from 'next/server';
import { isPublicPath } from './utils/publicPaths';

/**
 * Guard de autenticación a nivel servidor (middleware de Next.js).
 *
 * - Rutas públicas: /login, /pantalla (TV con token propio), /voucher/*,
 *   /deslinde/*, y todo lo estático/manifest/API interna.
 * - Cualquier otra ruta requiere la cookie `token` (la que setea
 *   authStore.setAuth con js-cookie). Sin ella → redirect a /login.
 * - Usuario ya autenticado que visita /login → redirect a /.
 *
 * Nota: aquí solo se comprueba PRESENCIA de la cookie; la validez del JWT
 * la valida la API en cada request. Esto evita el "flash" de contenido
 * protegido sin necesidad de esperar al hidratado client-side.
 */

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasToken = Boolean(req.cookies.get('token')?.value);

  // Rutas públicas pasan siempre (con token, /login redirige a /).
  if (isPublicPath(pathname)) {
    if (hasToken && pathname === '/login') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Assets estáticos de public / service worker (defensa en profundidad)
  if (
    pathname.includes('.') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/workbox-') ||
    pathname.startsWith('/fallback-') ||
    pathname.startsWith('/swe-worker-')
  ) {
    return NextResponse.next();
  }

  // Ruta protegida sin cookie → al login antes de servir nada.
  if (!hasToken) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Excluye assets estáticos, manifest, scripts del Service Worker y el proxy /api.
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-[^/]+\\.js|fallback-[^/]+\\.js|swe-worker-[^/]+\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|css|woff2?)$).*)',
  ],
};
