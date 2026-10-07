import { z } from 'zod';

// ========================
// DASHBOARD STATS SCHEMA
// ========================
export const DashboardStatsSchema = z.object({
  pilotos: z.number(),
  pilotosActivos: z.number(),
  pilotosDisponiblesHoy: z.number(),
  pasajeros30d: z.number(),
  promedioDiarioPasajeros: z.string(),
  vuelosTotal: z.number(),
  vuelosHoy: z.number(),
  vuelosFuturos: z.number(),
  reservasRecientes: z.array(
    z.object({
      id: z.number(),
      numeroReserva: z.string().nullable().optional(),
      nombreTitular: z.string(),
      email: z.string().nullable().optional(),
      telefono: z.string().nullable().optional(),
      estadoPago: z.string(),
      valorTotal: z.number(),
      abono: z.number(),
      fechaAgenda: z.string().nullable().optional(),
      createdAt: z.string().or(z.date()),
      totalPasajeros: z.number(),
      pasajeros: z.array(
        z.object({
          id: z.number(),
          nombre: z.string(),
        })
      ).optional(),
    })
  ),
});
export type DashboardStatsDTO = z.infer<typeof DashboardStatsSchema>;

// ========================
// METRICAS & ANALYTICS SCHEMAS
// ========================
export const MetricasQuerySchema = z.object({
  mes: z.coerce.number().min(0).max(11).optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
});
export type MetricasQuery = z.infer<typeof MetricasQuerySchema>;

export const PilotoRendimientoSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  vuelos: z.number(),
  ingresos: z.number(),
  comisiones: z.number(),
});
export type PilotoRendimiento = z.infer<typeof PilotoRendimientoSchema>;

export const DemandaDiaSchema = z.object({
  dia: z.string(),
  agendados: z.number(),
  completados: z.number(),
  cancelados: z.number(),
});
export type DemandaDia = z.infer<typeof DemandaDiaSchema>;

export const GastoCategoriaSchema = z.object({
  categoria: z.string(),
  monto: z.number(),
  porcentaje: z.number(),
});
export type GastoCategoria = z.infer<typeof GastoCategoriaSchema>;

export const MetricasFinancierasSchema = z.object({
  mes: z.number(),
  year: z.number(),
  totalAgendados: z.number(),
  totalCompletados: z.number(),
  totalCancelados: z.number(),
  ingresosTotales: z.number(),
  pagosPilotos: z.number(),
  gastosOperativos: z.number(),
  pagoEscuela: z.number(),
  margenNetoPorcentaje: z.number(),
  pilotosTop: z.array(PilotoRendimientoSchema),
  demandaMensual: z.array(DemandaDiaSchema),
  gastosPorCategoria: z.array(GastoCategoriaSchema),
});
export type MetricasFinancierasDTO = z.infer<typeof MetricasFinancierasSchema>;

// ========================
// REPORTES & MANIFIESTOS SCHEMAS
// ========================
export const ManifiestoItemSchema = z.object({
  id: z.number(),
  hora: z.string(),
  fechaHora: z.string().or(z.date()),
  estado: z.string(),
  pilotoId: z.number(),
  pilotoNombre: z.string(),
  pilotoLicencia: z.boolean().default(false),
  pilotoCategoria: z.string().nullable().optional(),
  pasajeroId: z.number(),
  pasajeroNombre: z.string(),
  pasajeroRut: z.string().nullable().optional(),
  pasajeroPeso: z.number().nullable().optional(),
  pasajeroPesoVerificado: z.number().nullable().optional(),
  pasajeroContactoEmergencia: z.string().nullable().optional(),
  pasajeroTelefonoEmergencia: z.string().nullable().optional(),
  pasajeroCondicionFisica: z.string().nullable().optional(),
  pasajeroFirmaDeslinde: z.boolean().default(false),
  reservaId: z.number().nullable().optional(),
  reservaNumero: z.string().nullable().optional(),
  reservaTitular: z.string().nullable().optional(),
  reservaTelefono: z.string().nullable().optional(),
});
export type ManifiestoItemDTO = z.infer<typeof ManifiestoItemSchema>;

export const ManifiestoDiarioSchema = z.object({
  fecha: z.string(),
  totalVuelos: z.number(),
  totalCompletados: z.number(),
  totalFirmados: z.number(),
  vuelos: z.array(ManifiestoItemSchema),
});
export type ManifiestoDiarioDTO = z.infer<typeof ManifiestoDiarioSchema>;

export const LiquidacionDetalleVueloSchema = z.object({
  vueloId: z.number(),
  fechaHora: z.string().or(z.date()),
  pasajeroNombre: z.string(),
  valorPactado: z.number(),
  pagoPiloto: z.number(),
  estado: z.string(),
});
export type LiquidacionDetalleVueloDTO = z.infer<typeof LiquidacionDetalleVueloSchema>;

export const LiquidacionPilotoItemSchema = z.object({
  pilotoId: z.number(),
  nombre: z.string(),
  email: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  tarifaBase: z.number(),
  totalVuelosCompletados: z.number(),
  totalVuelosAgendados: z.number(),
  totalAPagar: z.number(),
  vuelos: z.array(LiquidacionDetalleVueloSchema),
});
export type LiquidacionPilotoItemDTO = z.infer<typeof LiquidacionPilotoItemSchema>;

export const ReporteLiquidacionesSchema = z.object({
  periodo: z.string(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  totalVuelosGlobal: z.number(),
  totalMontoGlobal: z.number(),
  pilotos: z.array(LiquidacionPilotoItemSchema),
});
export type ReporteLiquidacionesDTO = z.infer<typeof ReporteLiquidacionesSchema>;
