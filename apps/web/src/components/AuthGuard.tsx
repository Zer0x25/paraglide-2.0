"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { isPublicPath } from '../utils/publicPaths';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, initialize } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicialización una vez al montar; no deriva de props
    setIsInitialized(true);
  }, [initialize]);

  useEffect(() => {
    if (isInitialized) {
      if (!token && !isPublicPath(pathname)) {
        router.push('/login');
      } else if (token && pathname === '/login') {
        router.push('/');
      }
    }
  }, [isInitialized, token, pathname, router]);

  if (!isInitialized) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50">Cargando...</div>;
  }

  // Mientras se completa una redirección, NO renderizar contenido protegido
  // (evita el "flash" del dashboard antes de que cargue el login).
  const isPublicPage = isPublicPath(pathname);
  if (!token && !isPublicPage) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50">Cargando...</div>;
  }
  if (token && pathname === '/login') {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50">Cargando...</div>;
  }

  return <>{children}</>;
}
