"use client";

import { withModule } from '@/components/withModule';
import { useEmpresaPublico } from '../../hooks/useEmpresaPublico';
import { usePantallaController } from './hooks/usePantallaController';
import { PantallaAccesoRestringido } from './components/PantallaAccesoRestringido';
import { PantallaHeader } from './components/PantallaHeader';
import { PantallaTurnosBoard } from './components/PantallaTurnosBoard';
import { PantallaSidebarInfo } from './components/PantallaSidebarInfo';
import { PantallaAdminModal } from './components/PantallaAdminModal';

function PantallaSalaEsperaPage() {
  const { empresa } = useEmpresaPublico();
  const nombreEscuela = empresa?.nombre ?? 'PARAGLIDE FLIGHT CENTER';

  const {
    data,
    loading,
    accessStatus,
    currentTime,
    currentDateStr,
    isFullscreen,
    qrDataUrl,
    isAdmin,
    showAdminPanel,
    dailyLink,
    tvLink,
    copiedKey,
    openAdminPanel,
    closeAdminPanel,
    toggleFullscreen,
    regenerateLink,
    copyLink,
    saveTvToBrowser,
    formatExpiry,
  } = usePantallaController();

  const estadoPista = data?.clima?.estadoPista || 'ABIERTA';

  const adminControls = (
    <PantallaAdminModal
      isAdmin={isAdmin}
      showAdminPanel={showAdminPanel}
      dailyLink={dailyLink}
      tvLink={tvLink}
      copiedKey={copiedKey}
      onOpenAdminPanel={openAdminPanel}
      onCloseAdminPanel={closeAdminPanel}
      onCopyLink={copyLink}
      onRegenerateLink={regenerateLink}
      onSaveTvToBrowser={saveTvToBrowser}
      formatExpiry={formatExpiry}
    />
  );

  if (accessStatus === 'invalid') {
    return (
      <>
        <PantallaAccesoRestringido />
        {!isAdmin && (
          <a
            href="/login"
            className="fixed bottom-4 right-4 z-50 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-2xl text-xs font-black text-slate-300 shadow-2xl transition"
          >
            ¿Eres administrador? Inicia sesión
          </a>
        )}
        {adminControls}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none">
      <PantallaHeader
        nombreEscuela={nombreEscuela}
        estadoPista={estadoPista}
        data={data}
        currentTime={currentTime}
        currentDateStr={currentDateStr}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <main className="my-6 grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        <PantallaTurnosBoard data={data} loading={loading} />
        <PantallaSidebarInfo qrDataUrl={qrDataUrl} />
      </main>

      <footer className="bg-slate-900/60 border border-slate-800/80 px-6 py-3 rounded-2xl flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>ESTACIÓN OPERACIONAL ACTIVA</span>
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          {data?.clima?.observaciones
            ? `Aviso del Director: "${data.clima.observaciones}"`
            : 'Vuelos operando con normalidad.'}
        </div>
      </footer>

      {adminControls}
    </div>
  );
}

export default withModule('pantalla', PantallaSalaEsperaPage);

