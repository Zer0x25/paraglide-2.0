"use client";

import { OfflinePageGuard } from '@/components/OfflinePageGuard';
import { useAnaliticasController } from './hooks/useAnaliticasController';
import {
  AnaliticasHeader,
  AnaliticasSummaryCards,
  AnaliticasDemandaChart,
  AnaliticasPilotosList,
  AnaliticasGastosBreakdown,
  AnaliticasGastoModal,
} from './components';

export default function AnaliticasPage() {
  const controller = useAnaliticasController();

  return (
    <OfflinePageGuard pageTitle="Analíticas y Finanzas">
      <div className="space-y-6 pb-12">
        <AnaliticasHeader
          selectedMonth={controller.selectedMonth}
          setSelectedMonth={controller.setSelectedMonth}
          selectedYear={controller.selectedYear}
          setSelectedYear={controller.setSelectedYear}
          currentMonthName={controller.currentMonthName}
          monthsList={controller.monthsList}
          yearsList={controller.yearsList}
          isLoading={controller.isLoading}
          isFetching={controller.isFetching}
          onRefetch={controller.refetch}
          onOpenGastoModal={() => controller.setIsGastoModalOpen(true)}
        />

        <AnaliticasSummaryCards
          metrics={controller.metrics}
          isLoading={controller.isLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AnaliticasDemandaChart
              demandaMensual={controller.metrics?.demandaMensual}
              isLoading={controller.isLoading}
              isDark={controller.isDark}
            />
          </div>
          <AnaliticasPilotosList
            pilotosTop={controller.metrics?.pilotosTop}
            isLoading={controller.isLoading}
          />
        </div>

        <AnaliticasGastosBreakdown
          gastosPorCategoria={controller.metrics?.gastosPorCategoria}
          gastosOperativosTotal={controller.metrics?.gastosOperativos || 0}
          isLoading={controller.isLoading}
        />

        <AnaliticasGastoModal
          isOpen={controller.isGastoModalOpen}
          onClose={controller.cerrarModalGasto}
          onSubmit={controller.handleAddGasto}
          formData={controller.gastoForm}
          setFormData={controller.setGastoForm}
          categorias={controller.categoriasGastos}
        />
      </div>
    </OfflinePageGuard>
  );
}
