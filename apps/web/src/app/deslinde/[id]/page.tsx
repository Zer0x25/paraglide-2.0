"use client";

import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useIsFetching, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiRaw } from '@/services/api';
import { FirmaDeslindeForm, FirmaData } from '@/components/FirmaDeslindeForm';
import { useReservaPublica } from '@/hooks/useReservaPublica';

interface PasajeroPublico {
  id: number;
  tokenPublico?: string | null;
  shortId?: string | null;
  nombre: string;
  rutDni?: string | null;
  peso?: number | null;
  pesoVerificado?: number | null;
  contactoEmergencia?: string | null;
  telefonoEmergencia?: string | null;
  condicionFisica?: string | null;
  firmaDeslinde: boolean;
  firmaFecha?: string | null;
}

interface ReservaPublica {
  id: number;
  numeroReserva?: string | null;
  tokenPublico?: string | null;
  shortId?: string | null;
  nombreTitular: string;
  fechaReserva?: string | null;
  estadoPago: string;
  pasajeros: PasajeroPublico[];
}

export default function DeslindePublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const [reservaId, setReservaId] = useState<string | null>(null);

  // Pasajero actualmente seleccionado para firmar
  const [selectedPasajero, setSelectedPasajero] = useState<PasajeroPublico | null>(null);

  const queryClient = useQueryClient();
  const {
    data: reserva,
    isLoading: cargandoReserva,
    error: errorReserva,
  } = useReservaPublica<ReservaPublica>(reservaId);

  // No se expone el detalle del backend: el texto al usuario es fijo, como siempre.
  const error = errorReserva
    ? 'No pudimos encontrar la información de esta reserva o el enlace ha expirado.'
    : null;

  const selectPasajero = (p: PasajeroPublico) => {
    setSelectedPasajero(p);
  };

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      if (p?.id) setReservaId(p.id);
    });
  }, [params]);

  // Auto seleccionar el primer pasajero que no haya firmado
  /* eslint-disable react-hooks/set-state-in-effect -- selección automática al llegar la reserva; no es estado derivado */
  useEffect(() => {
    const primerSinFirma = reserva?.pasajeros?.find((p: PasajeroPublico) => !p.firmaDeslinde);
    if (primerSinFirma) {
      setSelectedPasajero(primerSinFirma);
    }
  }, [reserva]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const firmaMutation = useMutation({
    mutationFn: (data: FirmaData) => {
      // Identificador no secuencial (tokenPublico/shortId); nunca el id numérico.
      const paxIdentifier =
        selectedPasajero?.tokenPublico || selectedPasajero?.shortId || '';
      return apiRaw.post(`/public/pasajeros/${paxIdentifier}/firma`, data);
    },
    onSuccess: async () => {
      toast.success('¡Deslinde firmado exitosamente! Buen vuelo 🪂');
      // Refleja la firma en la lista de pasajeros (antes: await fetchReserva()).
      await queryClient.invalidateQueries({ queryKey: ['reserva-publica', reservaId] });
    },
    onError: (err: unknown) => {
      console.error(err);
      {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(typeof msg === 'string' ? msg : 'Ocurrió un error al guardar el deslinde.');
      }
    },
  });

  const submitting = firmaMutation.isPending;
  // Spinner de carga completa solo mientras se re-valida la reserva tras el POST
  // (equivale al fetchReserva() con setLoading(true) de antes).
  const recargasReserva = useIsFetching({ queryKey: ['reserva-publica', reservaId] });
  const loading = cargandoReserva || (submitting && recargasReserva > 0);

  const handleSaveSignature = (data: FirmaData) => {
    if (!selectedPasajero) return;
    firmaMutation.mutate(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-700 dark:text-slate-200 font-medium">Cargando formulario de deslinde...</p>
        </div>
      </div>
    );
  }

  if (error || !reserva) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Enlace no disponible</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const todosFirmados = reserva.pasajeros.every(p => p.firmaDeslinde);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Banner de Bienvenida */}
        <div className="bg-linear-to-br from-blue-600 to-indigo-700 text-white p-5 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">
              <ShieldCheck size={16} />
              <span>Check-in Digital Seguro</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Deslinde de Responsabilidad</h1>
            <p className="text-blue-100 font-medium text-sm">
              Reserva #{reserva.numeroReserva || reserva.shortId} • Titular: <strong>{reserva.nombreTitular}</strong>
            </p>
          </div>
        </div>

        {/* Lista de Pasajeros de la Reserva */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
          <h2 className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Pasajeros del Grupo ({reserva.pasajeros.length})
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {reserva.pasajeros.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => !p.firmaDeslinde && selectPasajero(p)}
                disabled={p.firmaDeslinde}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                  p.firmaDeslinde
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-300 cursor-default'
                    : selectedPasajero?.id === p.id
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 dark:border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    p.firmaDeslinde ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/80 dark:text-emerald-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200'
                  }`}>
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{p.nombre}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{p.rutDni || 'Sin RUT'}</p>
                  </div>
                </div>

                <div>
                  {p.firmaDeslinde ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/90 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 size={14} className="mr-1" /> Firmado
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/90 border border-blue-300 dark:border-blue-800 px-2.5 py-1 rounded-full shadow-2xs">
                      Pendiente
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Estado si todos firmaron */}
        {todosFirmados && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 p-5 sm:p-6 rounded-3xl text-center space-y-3 shadow-sm">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-emerald-950 dark:text-emerald-300">¡Todo el grupo ha completado su deslinde!</h3>
            <p className="text-emerald-800 dark:text-emerald-300/90 text-sm">
              Presenten su nombre al equipo en la pista de despegue. ¡Que tengan un vuelo increíble!
            </p>
          </div>
        )}

        {/* Formulario de Firma si hay un pasajero seleccionado pendiente */}
        {!todosFirmados && selectedPasajero && !selectedPasajero.firmaDeslinde && (
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Firmar por: <span className="text-blue-600 dark:text-blue-400">{selectedPasajero.nombre}</span>
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-xs mt-0.5">
                Por favor verifica tus datos de seguridad antes de firmar.
              </p>
            </div>
            
            <FirmaDeslindeForm
              pasajero={selectedPasajero}
              isSubmitting={submitting}
              onSubmit={handleSaveSignature}
            />
          </div>
        )}

      </div>
    </div>
  );
}
