import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../../test/render';
import {
  AnaliticasHeader,
  AnaliticasSummaryCards,
  AnaliticasDemandaChart,
  AnaliticasPilotosList,
  AnaliticasGastosBreakdown,
  AnaliticasGastoModal,
} from '../index';
import type { MetricasFinancierasDTO, PilotoRendimiento, DemandaDia, GastoCategoria } from '@parapente/shared';
import type { GastoFormData } from '../../hooks/useAnaliticasController';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{React.Children.toArray(children)}</div>
  ),
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

const mockMetricas: MetricasFinancierasDTO = {
  mes: 8,
  year: 2026,
  totalAgendados: 20,
  totalCompletados: 15,
  totalCancelados: 2,
  ingresosTotales: 750000,
  pagosPilotos: 375000,
  gastosOperativos: 50000,
  pagoEscuela: 325000,
  margenNetoPorcentaje: 43.3,
  pilotosTop: [
    { id: 1, nombre: 'Rodrigo Morales', vuelos: 10, ingresos: 500000, comisiones: 250000 },
  ],
  demandaMensual: [
    { dia: '2026-09-01', agendados: 5, completados: 4, cancelados: 1 },
  ],
  gastosPorCategoria: [
    { categoria: 'Combustible', monto: 50000, porcentaje: 100 },
  ],
};

describe('Componentes Atómicos de Analíticas (ADR 014)', () => {
  describe('AnaliticasHeader', () => {
    it('debe renderizar título, selectores y disparar eventos de actualización y modal', () => {
      const onSetSelectedMonth = vi.fn();
      const onSetSelectedYear = vi.fn();
      const onRefetch = vi.fn();
      const onOpenGastoModal = vi.fn();

      render(
        <AnaliticasHeader
          selectedMonth={8}
          setSelectedMonth={onSetSelectedMonth}
          selectedYear={2026}
          setSelectedYear={onSetSelectedYear}
          currentMonthName="septiembre de 2026"
          monthsList={['Enero', 'Febrero', 'Septiembre']}
          yearsList={[2025, 2026, 2027]}
          isLoading={false}
          isFetching={false}
          onRefetch={onRefetch}
          onOpenGastoModal={onOpenGastoModal}
        />
      );

      expect(screen.getByText('Panel de Analíticas y Finanzas')).toBeInTheDocument();
      expect(screen.getByText(/Desempeño general — septiembre de 2026/i)).toBeInTheDocument();

      const selectMes = screen.getByLabelText('Seleccionar mes para reporte de analíticas');
      fireEvent.change(selectMes, { target: { value: '1' } });
      expect(onSetSelectedMonth).toHaveBeenCalledWith(1);

      const selectAno = screen.getByLabelText('Seleccionar año para reporte de analíticas');
      fireEvent.change(selectAno, { target: { value: '2025' } });
      expect(onSetSelectedYear).toHaveBeenCalledWith(2025);

      const btnActualizar = screen.getByRole('button', { name: /Actualizar/i });
      fireEvent.click(btnActualizar);
      expect(onRefetch).toHaveBeenCalled();

      const btnGasto = screen.getByRole('button', { name: /Registrar Gasto/i });
      fireEvent.click(btnGasto);
      expect(onOpenGastoModal).toHaveBeenCalled();
    });

    it('debe deshabilitar el botón de actualizar y mostrar texto de carga cuando isLoading o isFetching es true', () => {
      render(
        <AnaliticasHeader
          selectedMonth={8}
          setSelectedMonth={vi.fn()}
          selectedYear={2026}
          setSelectedYear={vi.fn()}
          currentMonthName="septiembre de 2026"
          monthsList={['Enero']}
          yearsList={[2026]}
          isLoading={true}
          isFetching={false}
          onRefetch={vi.fn()}
          onOpenGastoModal={vi.fn()}
        />
      );

      const btnCarga = screen.getByRole('button', { name: /Cargando\.\.\./i });
      expect(btnCarga).toBeDisabled();
    });
  });

  describe('AnaliticasSummaryCards', () => {
    it('debe renderizar los 4 KPIs correctamente con sus montos formateados', () => {
      render(<AnaliticasSummaryCards metrics={mockMetricas} isLoading={false} />);

      expect(screen.getByText('Ingresos Totales')).toBeInTheDocument();
      expect(screen.getByText('Pagos a Pilotos')).toBeInTheDocument();
      expect(screen.getByText('Gastos Operativos')).toBeInTheDocument();
      expect(screen.getByText('Margen Neto Escuela')).toBeInTheDocument();

      expect(screen.getByText('15 vuelos')).toBeInTheDocument();
      expect(screen.getByText('Comisiones')).toBeInTheDocument();
      expect(screen.getByText('1 categorías')).toBeInTheDocument();
      expect(screen.getByText('43.3% margen')).toBeInTheDocument();
    });

    it('debe mostrar skeletons cuando isLoading es true', () => {
      const { container } = render(<AnaliticasSummaryCards metrics={undefined} isLoading={true} />);
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBe(16);
    });

    it('debe aplicar estilo rojo si el margen neto es negativo', () => {
      const metricasNegativas: MetricasFinancierasDTO = {
        ...mockMetricas,
        pagoEscuela: -50000,
      };
      render(<AnaliticasSummaryCards metrics={metricasNegativas} isLoading={false} />);
      expect(screen.getByText('Margen Neto Escuela')).toBeInTheDocument();
    });
  });

  describe('AnaliticasDemandaChart', () => {
    it('debe renderizar el gráfico Recharts con los datos de demanda mensual', () => {
      const demandaData: DemandaDia[] = [
        { dia: '01', agendados: 5, completados: 4, cancelados: 1 },
      ];
      render(
        <AnaliticasDemandaChart
          demandaMensual={demandaData}
          isLoading={false}
          isDark={false}
        />
      );

      expect(screen.getByText('Demanda Diaria de Vuelos')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('debe mostrar loader cuando isLoading es true', () => {
      render(
        <AnaliticasDemandaChart
          demandaMensual={undefined}
          isLoading={true}
          isDark={false}
        />
      );

      expect(screen.getByText('Cargando datos de demanda...')).toBeInTheDocument();
    });
  });

  describe('AnaliticasPilotosList', () => {
    it('debe listar los pilotos y sus comisiones', () => {
      const pilotos: PilotoRendimiento[] = [
        { id: 1, nombre: 'Rodrigo Morales', vuelos: 10, ingresos: 500000, comisiones: 250000 },
      ];
      render(<AnaliticasPilotosList pilotosTop={pilotos} isLoading={false} />);

      expect(screen.getByText('Rendimiento por Piloto')).toBeInTheDocument();
      expect(screen.getByText('Rodrigo Morales')).toBeInTheDocument();
      expect(screen.getByText('10 vuelos realizados')).toBeInTheDocument();
    });

    it('debe mostrar mensaje vacío si no hay pilotos registrados', () => {
      render(<AnaliticasPilotosList pilotosTop={[]} isLoading={false} />);
      expect(screen.getByText('No hay registros de vuelos para este periodo.')).toBeInTheDocument();
    });

    it('debe mostrar skeletons de pilotos cuando isLoading es true', () => {
      const { container } = render(<AnaliticasPilotosList pilotosTop={undefined} isLoading={true} />);
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBe(12);
    });
  });

  describe('AnaliticasGastosBreakdown', () => {
    it('debe mostrar el desglose de gastos y porcentajes', () => {
      const gastos: GastoCategoria[] = [
        { categoria: 'Combustible', monto: 50000, porcentaje: 70 },
        { categoria: 'Seguros', monto: 20000, porcentaje: 30 },
      ];
      render(
        <AnaliticasGastosBreakdown
          gastosPorCategoria={gastos}
          gastosOperativosTotal={70000}
          isLoading={false}
        />
      );

      expect(screen.getByText('Desglose de Gastos Operativos')).toBeInTheDocument();
      expect(screen.getByText('Combustible')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
      expect(screen.getByText('Seguros')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('debe mostrar mensaje vacío si no hay gastos', () => {
      render(
        <AnaliticasGastosBreakdown
          gastosPorCategoria={[]}
          gastosOperativosTotal={0}
          isLoading={false}
        />
      );

      expect(screen.getByText('No se registran gastos operativos en este mes.')).toBeInTheDocument();
    });

    it('debe mostrar skeletons de gastos cuando isLoading es true', () => {
      const { container } = render(
        <AnaliticasGastosBreakdown
          gastosPorCategoria={undefined}
          gastosOperativosTotal={0}
          isLoading={true}
        />
      );
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBe(9);
    });
  });

  describe('AnaliticasGastoModal', () => {
    const defaultFormData: GastoFormData = {
      fecha: '2026-09-25',
      categoria: 'Combustible',
      monto: '35000',
      descripcion: 'Bencina camioneta',
    };

    it('no debe renderizar nada si isOpen es false', () => {
      render(
        <AnaliticasGastoModal
          isOpen={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          formData={defaultFormData}
          setFormData={vi.fn()}
          categorias={['Combustible', 'Seguros']}
        />
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Registrar Gasto')).not.toBeInTheDocument();
    });

    it('debe renderizar el diálogo modal y disparar onSubmit al guardar', () => {
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      const onClose = vi.fn();
      const setFormData = vi.fn();

      render(
        <AnaliticasGastoModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
          formData={defaultFormData}
          setFormData={setFormData}
          categorias={['Combustible', 'Seguros']}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Registrar Gasto/i })).toBeInTheDocument();

      const btnGuardar = screen.getByRole('button', { name: /Guardar Gasto/i });
      fireEvent.click(btnGuardar);
      expect(onSubmit).toHaveBeenCalled();

      const btnCancelar = screen.getByRole('button', { name: /Cancelar/i });
      fireEvent.click(btnCancelar);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
