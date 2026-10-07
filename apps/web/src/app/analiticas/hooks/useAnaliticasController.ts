import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRaw as api } from '@/services/api';
import { typedApiOutbox } from '@/services/apiOutbox';
import { toast } from 'sonner';
import { useTheme } from '@/components/ThemeProvider';
import { MetricasFinancierasDTO, dateKeyLocal } from '@parapente/shared';
import { isQueuedError } from '@/hooks/useDomainMutation';

export interface GastoFormData {
  fecha: string;
  categoria: string;
  monto: string;
  descripcion: string;
}

export const CATEGORIAS_GASTOS: readonly string[] = [
  'Combustible',
  'Mantenimiento y Reparación de Vehículo',
  'Seguros',
  'Marketing y Publicidad',
  'Equipamiento',
  'Viáticos / Alimentación',
  'Permisos / Trámites',
  'Peajes y Estacionamientos',
  'Otros',
];

export const MONTHS_LIST: readonly string[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function useAnaliticasController() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Modal State
  const [isGastoModalOpen, setIsGastoModalOpen] = useState(false);
  const [gastoForm, setGastoForm] = useState<GastoFormData>({
    fecha: dateKeyLocal(),
    categoria: 'Combustible',
    monto: '',
    descripcion: '',
  });

  // TanStack Query (ADR 005 / ADR 009): datos cacheados en memoria e IndexedDB.
  const {
    data: metrics,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<MetricasFinancierasDTO>({
    queryKey: ['metricas', 'financiero', selectedMonth, selectedYear],
    queryFn: async () => {
      const data = await api.get<MetricasFinancierasDTO>(
        `/metricas/financiero?mes=${selectedMonth}&year=${selectedYear}`
      );
      return data as unknown as MetricasFinancierasDTO;
    },
    staleTime: 60_000,
  });

  const cerrarModalGasto = () => {
    setIsGastoModalOpen(false);
    setGastoForm({
      fecha: dateKeyLocal(),
      categoria: 'Combustible',
      monto: '',
      descripcion: '',
    });
  };

  const handleAddGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoForm.monto || isNaN(Number(gastoForm.monto)) || Number(gastoForm.monto) < 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    try {
      // ADR 009: el gasto operativo en pista puede ocurrir sin red — va por el outbox.
      await typedApiOutbox.gastos.crear({
        fecha: gastoForm.fecha,
        categoria: gastoForm.categoria,
        monto: Number(gastoForm.monto),
        descripcion: gastoForm.descripcion,
      });
      toast.success('Gasto registrado con éxito');
      cerrarModalGasto();
      queryClient.invalidateQueries({ queryKey: ['metricas', 'financiero'] });
    } catch (error: unknown) {
      if (isQueuedError(error) || (error as { queued?: boolean })?.queued) {
        // ADR 009: sin red — el gasto quedó en el outbox y se enviará al reconectar.
        toast.info('Sin conexión: el gasto se enviará automáticamente al reconectar');
        cerrarModalGasto();
        return;
      }
      console.error(error);
      toast.error('Error al guardar el gasto');
    }
  };

  const currentMonthName = new Date(selectedYear, selectedMonth).toLocaleString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
  const currentYearActual = new Date().getFullYear();
  const yearsList = Array.from({ length: 5 }, (_, i) => currentYearActual - 3 + i);

  return {
    // Temporal Filters
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    currentMonthName,
    monthsList: MONTHS_LIST,
    yearsList,

    // Query Metrics
    metrics,
    isLoading,
    isFetching,
    refetch,

    // Gasto Modal & Form
    isGastoModalOpen,
    setIsGastoModalOpen,
    gastoForm,
    setGastoForm,
    cerrarModalGasto,
    handleAddGasto,
    categoriasGastos: CATEGORIAS_GASTOS,

    // Theme
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
  };
}

export type UseAnaliticasControllerReturn = ReturnType<typeof useAnaliticasController>;
