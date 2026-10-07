import { prisma } from '../../plugins/prisma';
import { CalculoValorDTO } from '@parapente/shared';
import { toNum } from '../money.util';

/** Redondeo monetario a 2 decimales (ADR 008: nunca decimales flotantes crudos). */
export const redondear2 = (x: number): number => Math.round(x * 100) / 100;

export const inicioDeDia = (d: Date | string): number => {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/**
 * Fase 2: cálculo de valor de una reserva a partir de tarifa (+ promoción opcional).
 * Lectura pura: no persiste nada. El servidor es la única fuente de verdad del
 * dinero (el valorTotal del cliente se ignora si difiere).
 */
export async function calcularValor(payload: {
  tarifaId: number;
  promocionId?: number;
  cantidadPasajeros: number;
}): Promise<CalculoValorDTO> {
  const tarifa = await prisma.tarifa.findFirst({
    where: { id: payload.tarifaId, deletedAt: null, activo: true },
  });
  if (!tarifa) {
    throw new Error('Tarifa no encontrada o inactiva');
  }

  let promocion: { nombre: string; tipoDescuento: string; valor: unknown; fechaInicio: Date | null; fechaFin: Date | null } | null = null;
  if (payload.promocionId !== undefined && payload.promocionId !== null) {
    promocion = (await prisma.promocion.findFirst({
      where: { id: payload.promocionId, deletedAt: null, activa: true },
    })) as any;
    if (!promocion) {
      throw new Error('Promoción no encontrada o inactiva');
    }
    const hoy = inicioDeDia(new Date());
    if (promocion.fechaInicio && inicioDeDia(promocion.fechaInicio) > hoy) {
      throw new Error(`La promoción "${promocion.nombre}" aún no está vigente`);
    }
    if (promocion.fechaFin && inicioDeDia(promocion.fechaFin) < hoy) {
      throw new Error(`La promoción "${promocion.nombre}" está vencida`);
    }
  }

  const precioUnitario = toNum(tarifa.precio);
  const precioBase = redondear2(precioUnitario * payload.cantidadPasajeros);

  let descuento = 0;
  let detallePromo = '';
  if (promocion) {
    const esPorcentaje = promocion.tipoDescuento === 'PORCENTAJE';
    const valorPromo = toNum(promocion.valor);
    if (esPorcentaje) {
      descuento = (precioBase * valorPromo) / 100;
      descuento = Math.min(redondear2(descuento), precioBase);
      detallePromo = ` − ${promocion.nombre} (${valorPromo}%)`;
    } else {
      // El descuento es al valor individual de cada vuelo:
      // (ej: si valor es $80.000 y descuento es $20.000, para 3 vuelos el descuento total es 3 * $20.000 = $60.000)
      const descuentoUnitario = Math.min(valorPromo, precioUnitario);
      descuento = redondear2(descuentoUnitario * payload.cantidadPasajeros);
      detallePromo = payload.cantidadPasajeros > 1
        ? ` − ${promocion.nombre} ($${valorPromo} ×${payload.cantidadPasajeros})`
        : ` − ${promocion.nombre} ($${valorPromo})`;
    }
  }

  const valorTotal = redondear2(precioBase - descuento);
  const detalle = `${tarifa.nombre} ×${payload.cantidadPasajeros}${detallePromo}`;

  return { precioBase, descuento, valorTotal, detalle };
}
