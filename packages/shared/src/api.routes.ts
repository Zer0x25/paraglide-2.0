import type { 
  VueloDTO, CreateVueloPayload,
  ReservaDTO, CreateReservaPayload, UpdateReservaPayload, CancelarReservaPayload,
  PilotoDTO, SugerirPilotoPayload,
  EquipoDTO, CreateEquipoPayload, CreateMantenimientoPayload,
  CondicionPistaDTO, CreateCondicionPistaPayload,
  PasajeroDTO, CreatePasajeroPayload, UpdatePasajeroPayload, ActualizarEstadoPasajerosPayload,
  PlantillaMensajeDTO, CreatePlantillaMensajePayload,
  DashboardStatsDTO, MetricasFinancierasDTO,
  LogAuditoriaDTO,
  TarifaDTO, CreateTarifaPayload,
  PromocionDTO, CreatePromocionPayload,
  FaqDTO, CreateFaqPayload,
  DeslindeVersionDTO, CreateDeslindePayload,
  ReglaOperativaDTO, UpsertReglaPayload,
  ConfiguracionBloqueDTO,
  ResolucionDiaDTO, CalcularValorPayload, CalculoValorDTO,
  EmpresaDTO, UpdateEmpresaPayload,
  NotificacionConfigDTO, UpdateNotificacionConfigPayload,
  UserDTO, UserListableDTO, CreateUserPayload, UpdateUserPayload, ChangePasswordPayload
} from './schemas/index';
import type { ListEnvelope } from './schemas/pagination';
import type { CreatePagoPayload, CreateDevolucionPayload } from './schemas/pagos';
import type { GastoDTO } from './schemas/gastos';

/**
 * Contrato Tipado E2E (ADR 010)
 * Esta interfaz define todas las firmas de los endpoints que el frontend consume.
 */
export interface AppApiContract {
  vuelos: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<VueloDTO>>;
    crear: (payload: any) => Promise<VueloDTO>;
    actualizar: (id: number, payload: any) => Promise<VueloDTO>;
    eliminar: (id: number) => Promise<void>;
    actualizarEstado: (id: number, payload: { estado: string; version?: number }) => Promise<VueloDTO>;
    agendarGrupo: (payload: { reservaId: number; fechaHora: string; asignaciones?: Record<number, number>; version?: number }) => Promise<{ success: boolean; vuelos: VueloDTO[] }>;
    asignacionAutomatica: (payload: { fechaHora: string; pasajeros: { id: number; peso: number }[] }) => Promise<{ asignaciones: Record<number, number>; error?: string }>;
  };
  reservas: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<ReservaDTO>>;
    obtener: (id: number) => Promise<ReservaDTO>;
    crear: (payload: CreateReservaPayload) => Promise<ReservaDTO>;
    actualizar: (id: number, payload: UpdateReservaPayload) => Promise<ReservaDTO>;
    eliminar: (id: number) => Promise<void>;
    agregarPago: (id: number, payload: CreatePagoPayload & { version?: number }) => Promise<ReservaDTO>;
    eliminarPago: (id: number, pagoId: number, version?: number) => Promise<ReservaDTO>;
    crearDevolucion: (id: number, payload: CreateDevolucionPayload & { version?: number }) => Promise<ReservaDTO>;
    eliminarDevolucion: (id: number, devolucionId: number, version?: number) => Promise<ReservaDTO>;
    actualizarEstadoPasajeros: (id: number, payload: ActualizarEstadoPasajerosPayload) => Promise<ReservaDTO>;
    cancelar: (id: number, payload: CancelarReservaPayload) => Promise<ReservaDTO>;
    desagendar: (id: number, payload?: { version?: number }) => Promise<ReservaDTO>;
    calcularValor: (payload: CalcularValorPayload) => Promise<CalculoValorDTO>;
    cerrar: (id: number, payload?: { version?: number }) => Promise<ReservaDTO>;
    reabrir: (id: number, payload: { motivo: string; version?: number }) => Promise<ReservaDTO>;
  };
  pilotos: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<PilotoDTO>>;
    crear: (payload: Partial<PilotoDTO>) => Promise<PilotoDTO>;
    actualizar: (id: number, payload: Partial<PilotoDTO>) => Promise<PilotoDTO>;
    eliminar: (id: number) => Promise<void>;
    obtenerDisponibilidad: (id: number) => Promise<any>;
    guardarDisponibilidad: (id: number, payload: { version: number; fechas: any[] }) => Promise<any>;
    resetDisponibilidad: (id: number, q?: { desde?: string; hasta?: string }) => Promise<any>;
    sugerir: (payload: SugerirPilotoPayload) => Promise<PilotoDTO[]>;
  };
  equipos: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<EquipoDTO>>;
    obtener: (id: number) => Promise<EquipoDTO>;
    crear: (payload: CreateEquipoPayload) => Promise<EquipoDTO>;
    actualizar: (id: number, payload: CreateEquipoPayload) => Promise<EquipoDTO>;
    eliminar: (id: number) => Promise<void>;
    agregarMantenimiento: (id: number, payload: CreateMantenimientoPayload) => Promise<any>;
    eliminarMantenimiento: (id: number, mantenimientoId: number) => Promise<void>;
  };
  gastos: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<GastoDTO>>;
    crear: (payload: Omit<GastoDTO, 'id' | 'version'>) => Promise<GastoDTO>;
    eliminar: (id: number, version?: number) => Promise<void>;
  };
  meteorologia: {
    obtenerActual: () => Promise<CondicionPistaDTO | null>;
    obtenerHistorial: (limit?: number) => Promise<CondicionPistaDTO[]>;
    registrar: (payload: CreateCondicionPistaPayload) => Promise<CondicionPistaDTO>;
    pronosticoOpenMeteo: () => Promise<CreateCondicionPistaPayload>;
    refrescarOpenMeteo: () => Promise<CondicionPistaDTO>;
  };
  configuracion: {
    listar: () => Promise<ConfiguracionBloqueDTO[]>;
    crear: (payload: Partial<ConfiguracionBloqueDTO>) => Promise<ConfiguracionBloqueDTO>;
    actualizar: (id: number, payload: Partial<ConfiguracionBloqueDTO>) => Promise<ConfiguracionBloqueDTO>;
    eliminar: (id: number) => Promise<void>;
    resolver: (q: { desde: string; hasta: string }) => Promise<Record<string, ResolucionDiaDTO>>;
    limpiarExpiradas: () => Promise<{ archivadas: number }>;
  };
  pasajeros: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<PasajeroDTO>>;
  };
  plantillas: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<PlantillaMensajeDTO>>;
    crear: (payload: CreatePlantillaMensajePayload) => Promise<PlantillaMensajeDTO>;
    actualizar: (id: number, payload: Partial<CreatePlantillaMensajePayload>) => Promise<PlantillaMensajeDTO>;
    eliminar: (id: number) => Promise<void>;
    renderizar: (payload: { plantillaId?: number; plantillaDraft?: CreatePlantillaMensajePayload; reservaId?: number; vueloId?: number }) => Promise<{ cuerpo: string }>;
  };
  auditoria: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<LogAuditoriaDTO>>;
  };
  tarifas: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<TarifaDTO>>;
    crear: (payload: CreateTarifaPayload) => Promise<TarifaDTO>;
    actualizar: (id: number, payload: Partial<CreateTarifaPayload>) => Promise<TarifaDTO>;
    eliminar: (id: number) => Promise<void>;
  };
  promociones: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<PromocionDTO>>;
    crear: (payload: CreatePromocionPayload) => Promise<PromocionDTO>;
    actualizar: (id: number, payload: Partial<CreatePromocionPayload>) => Promise<PromocionDTO>;
    eliminar: (id: number) => Promise<void>;
  };
  faqs: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<FaqDTO>>;
    crear: (payload: CreateFaqPayload) => Promise<FaqDTO>;
    actualizar: (id: number, payload: Partial<CreateFaqPayload>) => Promise<FaqDTO>;
    eliminar: (id: number) => Promise<void>;
  };
  deslindes: {
    listar: () => Promise<DeslindeVersionDTO[]>;
    crear: (payload: CreateDeslindePayload) => Promise<DeslindeVersionDTO>;
    actualizar: (id: number, payload: Partial<CreateDeslindePayload>) => Promise<DeslindeVersionDTO>;
    eliminar: (id: number) => Promise<void>;
    // `revision` = token de concurrencia optimista; `version` (número legal) es inmutable
    activar: (id: number, payload: { revision: number }) => Promise<DeslindeVersionDTO>;
  };
  reglasOperativas: {
    listar: () => Promise<ReglaOperativaDTO[]>;
    upsert: (clave: string, payload: UpsertReglaPayload) => Promise<ReglaOperativaDTO>;
    eliminar: (clave: string) => Promise<void>;
  };
  public: {
    deslindeActivo: () => Promise<DeslindeVersionDTO | null>;
    faqsPublicas: () => Promise<FaqDTO[]>;
    reglasOperativas: () => Promise<ReglaOperativaDTO[]>;
  };
  empresa: {
    obtenerPublico: () => Promise<EmpresaDTO | null>;
    obtener: () => Promise<EmpresaDTO>;
    actualizar: (payload: UpdateEmpresaPayload, version: number) => Promise<EmpresaDTO>;
  };
  notificaciones: {
    obtenerConfig: () => Promise<NotificacionConfigDTO>;
    actualizarConfig: (payload: UpdateNotificacionConfigPayload) => Promise<NotificacionConfigDTO>;
    pendientes: (query?: { horas?: string }) => Promise<unknown>;
  };
  dashboard: {
    stats: () => Promise<DashboardStatsDTO>;
  };
  users: {
    listar: (query?: Record<string, any>) => Promise<ListEnvelope<UserListableDTO>>;
    obtener: (id: number) => Promise<UserListableDTO>;
    crear: (payload: CreateUserPayload) => Promise<UserListableDTO>;
    actualizar: (id: number, payload: UpdateUserPayload) => Promise<UserListableDTO>;
    eliminar: (id: number) => Promise<void>;
    cambiarPassword: (id: number, payload: ChangePasswordPayload) => Promise<{ success: boolean }>;
  };
}
