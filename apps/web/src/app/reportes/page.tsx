"use client";

import { withModule } from '@/components/withModule';
import { useReportesController } from './hooks/useReportesController';
import { ReportesHeader } from './components/ReportesHeader';
import { ManifiestoDiarioSection } from './components/ManifiestoDiarioSection';
import { LiquidacionesSection } from './components/LiquidacionesSection';

function ReportesPage() {
  const {
    activeTab,
    setActiveTab,
    fechaManifiesto,
    setFechaManifiesto,
    searchManifiesto,
    setSearchManifiesto,
    manifiestoData,
    loadingManifiesto,
    vuelosFiltrados,
    setFechaRelativa,
    handlePrint,
    targetMonth,
    setTargetMonth,
    targetYear,
    setTargetYear,
    expandedPilotoId,
    setExpandedPilotoId,
    liquidacionesData,
    loadingLiquidaciones,
    handleDownloadCsv,
  } = useReportesController();

  return (
    <div className="space-y-6 relative pb-16 animate-in fade-in duration-300">
      <ReportesHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'MANIFIESTO' && (
        <ManifiestoDiarioSection
          fechaManifiesto={fechaManifiesto}
          onFechaChange={setFechaManifiesto}
          onFechaRelativa={setFechaRelativa}
          searchManifiesto={searchManifiesto}
          onSearchChange={setSearchManifiesto}
          onPrint={handlePrint}
          manifiestoData={manifiestoData}
          loadingManifiesto={loadingManifiesto}
          vuelosFiltrados={vuelosFiltrados}
        />
      )}

      {activeTab === 'LIQUIDACIONES' && (
        <LiquidacionesSection
          targetMonth={targetMonth}
          onMonthChange={setTargetMonth}
          targetYear={targetYear}
          onYearChange={setTargetYear}
          onDownloadCsv={handleDownloadCsv}
          liquidacionesData={liquidacionesData}
          loadingLiquidaciones={loadingLiquidaciones}
          expandedPilotoId={expandedPilotoId}
          onToggleExpandPiloto={(id) => setExpandedPilotoId(expandedPilotoId === id ? null : id)}
        />
      )}
    </div>
  );
}

export default withModule('reportes', ReportesPage);
