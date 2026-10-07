'use client';

import { useQuery } from '@tanstack/react-query';
import type { EmpresaDTO } from '@parapente/shared';

/**
 * Ficha pública de la empresa (Fase 2). Fallback null = los consumidores
 * muestran sus textos por defecto (compatibilidad con mocks de tests y
 * con despliegues donde la ficha aún no fue creada).
 *
 * Import dinámico de services/api dentro del queryFn: algunos tests usan
 * automock de axios sin factory, y un import estático a nivel de módulo
 * rompería su evaluación (misma razón por la que FirmaDeslindeForm lo hace).
 */
export function useEmpresaPublico() {
  const query = useQuery<EmpresaDTO | null>({
    queryKey: ['empresa-publico'],
    queryFn: async () => {
      const { default: typedApi } = await import('@/services/api');
      return typedApi.empresa.obtenerPublico();
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return { empresa: query.data ?? null, isLoading: query.isPending };
}
