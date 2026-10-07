"use client";

import { useQuery } from '@tanstack/react-query';
import { Users, UserCircle, Calendar as CalendarIcon, Clock, Plane, ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DashboardStatsDTO } from '@parapente/shared';
import api from '../services/api';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const DEFAULT_STATS: DashboardStatsDTO = {
  pilotos: 0,
  pilotosActivos: 0,
  pilotosDisponiblesHoy: 0,
  pasajeros30d: 0,
  promedioDiarioPasajeros: '0.0',
  vuelosTotal: 0,
  vuelosHoy: 0,
  vuelosFuturos: 0,
  reservasRecientes: []
};

export default function Home() {
  const isOnline = useOnlineStatus();

  const { data: statsData, isPending, isError } = useQuery<DashboardStatsDTO>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.dashboard.stats(),
    staleTime: 60_000,
    retry: false,
  });

  const stats = statsData ?? DEFAULT_STATS;
  const loading = isPending && !isError && !statsData;

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Hero Header */}
      <header className="bg-white/60 dark:bg-slate-900/60 p-3.5 sm:p-5 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isOnline ? (
              <div className="inline-flex items-center space-x-1.5 bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[11px] sm:text-xs md:text-sm font-medium mb-1 md:mb-2.5 border border-blue-100/50 dark:border-blue-900/60">
                <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-blue-500"></span>
                </span>
                <span>Sistema Activo</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-1.5 bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[11px] sm:text-xs md:text-sm font-medium mb-1 md:mb-2.5 border border-amber-200/60 dark:border-amber-900/60">
                <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-amber-500"></span>
                </span>
                <span>Modo Offline (Datos Locales)</span>
              </div>
            )}
            <h1 className="text-xl sm:text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight truncate">Panel de Control</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 md:mt-1 font-medium text-xs sm:text-sm md:text-lg capitalize truncate">{today}</p>
          </div>
          <div className="shrink-0">
            <Link href="/reservas" className="inline-flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-xs sm:text-sm md:text-base font-semibold hover:bg-slate-800 dark:hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              <Plus size={16} className="mr-1 sm:mr-2" />
              <span>Nueva Reserva</span>
            </Link>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <section aria-label="Métricas clave" className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-100 dark:border-slate-700/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-3 sm:p-4 md:p-0 md:bg-transparent md:dark:bg-transparent md:border-0 md:shadow-none">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1 */}
          <div className="bg-slate-50/80 dark:bg-slate-900/50 p-2.5 sm:p-4 rounded-2xl md:bg-white md:dark:bg-slate-800 md:p-6 md:rounded-3xl md:border md:border-slate-100 md:dark:border-slate-700 md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between">
            <div className="hidden md:block absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <Plane size={80} className="text-blue-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center space-x-2 md:space-x-3 mb-2 md:mb-4">
                <div className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-lg md:rounded-xl dark:bg-blue-900/40 dark:text-blue-400 shrink-0">
                  <Plane className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Vuelos de Hoy</p>
              </div>
              <div className="flex items-baseline space-x-1.5 md:space-x-2">
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{loading ? '-' : stats.vuelosHoy}</p>
                <p className="text-xs md:text-sm text-slate-400 font-medium">hoy</p>
              </div>
              <div className="mt-2 text-[11px] md:text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 md:py-1 rounded-md inline-block max-w-full truncate">
                <span className="md:hidden">+{loading ? '-' : stats.vuelosFuturos} próx.</span>
                <span className="hidden md:inline">+ {loading ? '-' : stats.vuelosFuturos} próximos agendados</span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-50/80 dark:bg-slate-900/50 p-2.5 sm:p-4 rounded-2xl md:bg-white md:dark:bg-slate-800 md:p-6 md:rounded-3xl md:border md:border-slate-100 md:dark:border-slate-700 md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between">
            <div className="hidden md:block absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <UserCircle size={80} className="text-emerald-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center space-x-2 md:space-x-3 mb-2 md:mb-4">
                <div className="p-1.5 md:p-2 bg-emerald-50 text-emerald-600 rounded-lg md:rounded-xl dark:bg-emerald-900/40 dark:text-emerald-400 shrink-0">
                  <UserCircle className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Pilotos Hoy</p>
              </div>
              <div className="flex items-baseline space-x-1.5 md:space-x-2">
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{loading ? '-' : stats.pilotosDisponiblesHoy}</p>
                <p className="text-xs md:text-sm text-slate-400 font-medium">disp.</p>
              </div>
              <div className="mt-2 text-[11px] md:text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 md:py-1 rounded-md inline-block max-w-full truncate">
                <span className="md:hidden">{loading ? '-' : stats.pilotosActivos} activos</span>
                <span className="hidden md:inline">disp. / {loading ? '-' : stats.pilotosActivos} activos</span>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-50/80 dark:bg-slate-900/50 p-2.5 sm:p-4 rounded-2xl md:bg-white md:dark:bg-slate-800 md:p-6 md:rounded-3xl md:border md:border-slate-100 md:dark:border-slate-700 md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between">
            <div className="hidden md:block absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <Users size={80} className="text-amber-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center space-x-2 md:space-x-3 mb-2 md:mb-4">
                <div className="p-1.5 md:p-2 bg-amber-50 text-amber-600 rounded-lg md:rounded-xl dark:bg-amber-900/40 dark:text-amber-400 shrink-0">
                  <Users className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Pasajeros <span className="hidden sm:inline">(30 días)</span></p>
              </div>
              <div className="flex items-baseline space-x-1.5 md:space-x-2">
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{loading ? '-' : stats.pasajeros30d}</p>
                <p className="text-xs md:text-sm text-slate-400 font-medium">nuevos</p>
              </div>
              <div className="mt-2 text-[11px] md:text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 md:py-1 rounded-md inline-block max-w-full truncate">
                <span className="md:hidden">~{loading ? '-' : stats.promedioDiarioPasajeros}/d</span>
                <span className="hidden md:inline">Promedio: {loading ? '-' : stats.promedioDiarioPasajeros} diarios</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Reservas Recientes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Reservas Recientes</h2>
            <Link href="/reservas" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center group">
              Ver todas <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 overflow-hidden">
            {stats.reservasRecientes.length > 0 ? (
              <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                {stats.reservasRecientes.map((reserva) => (
                  <li key={reserva.id} className="p-4 sm:p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-4 min-w-0">
                        <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg shrink-0">
                          {reserva.nombreTitular?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{reserva.nombreTitular}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{reserva.numeroReserva} • {reserva.email || 'Sin correo'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end sm:text-right gap-3 shrink-0">
                        <p className="font-semibold text-slate-900 dark:text-white">${(reserva.valorTotal || 0).toLocaleString('es-CL')}</p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          reserva.estadoPago === 'PAGADO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          reserva.estadoPago === 'ABONADO' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                          reserva.estadoPago === 'DEVUELTO' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {reserva.estadoPago}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <Clock size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <p>
                  {loading
                    ? 'Cargando reservas...'
                    : !isOnline && !statsData
                    ? 'Modo offline: sin reservas en caché local'
                    : 'No hay reservas recientes'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Accesos Directos</h2>
          
          <div className="grid grid-cols-1 gap-4">
            <Link href="/calendario" className="flex items-center p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                <CalendarIcon size={24} />
              </div>
              <div className="ml-4">
                <h3 className="font-bold text-slate-900 dark:text-white">Calendario</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Agendar y ver vuelos</p>
              </div>
            </Link>
            
            <Link href="/reservas" className="flex items-center p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 group">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                <Users size={24} />
              </div>
              <div className="ml-4">
                <h3 className="font-bold text-slate-900 dark:text-white">Reservas</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gestión de pasajeros</p>
              </div>
            </Link>

            <Link href="/pilotos" className="flex items-center p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 group">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                <UserCircle size={24} />
              </div>
              <div className="ml-4">
                <h3 className="font-bold text-slate-900 dark:text-white">Pilotos</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Personal y licencias</p>
              </div>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
