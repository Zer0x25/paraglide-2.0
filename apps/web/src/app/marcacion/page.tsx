'use client';

import { MarcacionPageView } from './components/MarcacionPageView';
import { useMarcacionController } from './hooks/useMarcacionController';
import { useAuthStore } from '@/store/authStore';

export default function MarcacionPage() {
  const user = useAuthStore((state) => state.user);
  const autorizado = user?.role === 'ADMIN' || user?.role === 'RECEPCION';
  const controller = useMarcacionController(autorizado);
  return <MarcacionPageView c={controller} autorizado={autorizado} />;
}
