import { toast } from 'sonner';
import { formatFechaEspanol, horaLocalHHMM } from '@parapente/shared';
import type { ReservaConPasajeros, PasajeroConVuelos, VueloConPiloto } from '@/types/reservaDetalle';
import { clasificarUv } from '../../../utils/uv';
import { formatCLP } from '../../../utils/format';

interface PronosticoSimple {
  indiceUv?: number | null;
}

export function useReservaWhatsApp(pronostico?: PronosticoSimple | null) {
  const openWhatsAppConfirmation = (reserva: ReservaConPasajeros) => {
    if (!reserva.telefono) {
      toast.error('La reserva no tiene un teléfono registrado');
      return;
    }

    const cleanPhone = reserva.telefono.replace(/[^\d+]/g, '');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    // Enlaces públicos solo con identificadores no secuenciales (tokenPublico/shortId).
    const publicId = reserva.tokenPublico || reserva.shortId || '';
    const deslindeUrl = `${origin}/deslinde/${publicId}`;
    const voucherUrl = `${origin}/voucher/${publicId}`;
    const fechaStr = reserva.fechaAgenda
      ? formatFechaEspanol(reserva.fechaAgenda, { weekday: 'long', day: 'numeric', month: 'long' })
      : 'fecha por coordinar';

    const totalPax = reserva.pasajeros?.length || 1;
    const saldoPendiente = Math.max(0, (reserva.valorTotal || 0) - (reserva.abono || 0));

    let mensaje = `¡Hola ${reserva.nombreTitular}! 🪂 Te confirmamos tu reserva #${reserva.numeroReserva || reserva.shortId} para ${totalPax} ${totalPax === 1 ? 'pasajero' : 'pasajeros'} (${fechaStr}).\n\n`;
    if (saldoPendiente > 0) {
      mensaje += `💰 Saldo pendiente: ${formatCLP(saldoPendiente)}\n\n`;
    }
    mensaje += `📝 Por favor completa y firma el deslinde digital de seguridad de tu grupo antes de llegar a la pista aquí:\n${deslindeUrl}\n\n`;
    mensaje += `🎫 Tu Ticket / Voucher: ${voucherUrl}\n\n¡Nos vemos para volar!`;

    const uvInfo = pronostico?.indiceUv != null ? clasificarUv(pronostico.indiceUv) : null;
    if (uvInfo && uvInfo.nivel !== 'DESCONOCIDO' && uvInfo.nivel !== 'BAJO') {
      mensaje += `\n☀️ Índice UV actual: ${Number(pronostico!.indiceUv).toFixed(1)} (${uvInfo.etiqueta}). ${uvInfo.recomendacion}\n`;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`;
    window.open(waUrl, '_blank');
  };

  const openWhatsAppPiloto = (
    reserva: ReservaConPasajeros,
    pasajero: PasajeroConVuelos,
    vuelo: VueloConPiloto
  ) => {
    const piloto = vuelo.piloto;
    if (!piloto?.telefono) {
      toast.error(`${piloto?.nombre || 'El piloto'} no tiene teléfono registrado`);
      return;
    }

    const cleanPhone = piloto.telefono.replace(/[^\d+]/g, '');
    const fechaStr = formatFechaEspanol(vuelo.fechaHora, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const horaStr = horaLocalHHMM(vuelo.fechaHora);

    let mensaje = `¡Hola ${piloto.nombre}! 🪂 Tienes un vuelo agendado el ${fechaStr} a las ${horaStr} con el pasajero ${pasajero.nombre} (Reserva #${reserva.numeroReserva || reserva.shortId}).\n\n¡Gracias por tu confirmación!`;

    const uvInfo = pronostico?.indiceUv != null ? clasificarUv(pronostico.indiceUv) : null;
    if (uvInfo && uvInfo.nivel !== 'DESCONOCIDO' && uvInfo.nivel !== 'BAJO') {
      mensaje += `\n☀️ Índice UV actual: ${Number(pronostico!.indiceUv).toFixed(1)} (${uvInfo.etiqueta}). ${uvInfo.recomendacion}\n`;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`;
    window.open(waUrl, '_blank');
  };

  return {
    openWhatsAppConfirmation,
    openWhatsAppPiloto,
  };
}
