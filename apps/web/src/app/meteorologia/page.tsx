"use client";

import { withModule } from '@/components/withModule';
import { useMeteorologiaController } from './hooks/useMeteorologiaController';
import { MeteoHeader } from './components/MeteoHeader';
import { MeteoHeroSemaforo } from './components/MeteoHeroSemaforo';
import { MeteoOpenMeteoCard } from './components/MeteoOpenMeteoCard';
import { MeteoInstrumentosGrid } from './components/MeteoInstrumentosGrid';
import { MeteoBoletinForm } from './components/MeteoBoletinForm';
import { MeteoHistorialList } from './components/MeteoHistorialList';

function MeteorologiaPage() {
  const {
    estadoActual,
    historial,
    loading,
    refetch,
    pronostico,
    pronosticoLoading,
    refrescarOpenMeteo,
    refrescando,
    enCooldown,
    labelCooldown,
    isSubmitting,
    form,
    onSubmit,
    cargarDatosActuales,
    handleQuickStatusChange,
    kmhAKt,
    cAF,
    mAPies,
    dirAEn,
    minutosDesde,
  } = useMeteorologiaController();

  const estado = estadoActual?.estadoPista || 'ABIERTA';

  return (
    <div className="space-y-6 relative pb-16 animate-in fade-in duration-300">
      <MeteoHeader
        loading={loading}
        refetch={refetch}
        refrescarOpenMeteo={refrescarOpenMeteo}
        refrescando={refrescando}
        enCooldown={enCooldown}
        labelCooldown={labelCooldown}
      />

      <MeteoHeroSemaforo
        estado={estado}
        observaciones={estadoActual?.observaciones}
        registradoPor={estadoActual?.registradoPor}
        fechaHora={estadoActual?.fechaHora}
        onQuickStatusChange={handleQuickStatusChange}
      />

      <MeteoOpenMeteoCard
        pronostico={pronostico}
        refrescando={refrescando}
        kmhAKt={kmhAKt}
        cAF={cAF}
        mAPies={mAPies}
        dirAEn={dirAEn}
      />

      <MeteoInstrumentosGrid
        estadoActual={estadoActual}
        dirAEn={dirAEn}
        minutosDesde={minutosDesde}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MeteoBoletinForm
          form={form}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
          cargarDatosActuales={cargarDatosActuales}
          pronosticoAvailable={!!pronostico}
          pronosticoLoading={pronosticoLoading}
          refrescando={refrescando}
        />

        <MeteoHistorialList historial={historial} />
      </div>
    </div>
  );
}

export default withModule('meteorologia', MeteorologiaPage);

