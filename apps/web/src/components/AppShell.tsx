"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { UserCircle, Calendar, Users, BookOpen, BarChart3, ShieldCheck, LogOut, Menu, X, Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { OutboxBadge } from '@/components/OutboxBadge';
import { OfflineBanner } from './OfflineBanner';
import { AuthGuard } from './AuthGuard';
import { useAuthStore } from '../store/authStore';
import { WeatherWidget } from './WeatherWidget';
import { getEnabledPremiumModules } from '@/modules/registry';
import { useEnabledModules, initModulesRuntime } from '@/modules/runtime';
import { isPublicPath } from '@/utils/publicPaths';
import { useWarmupData } from '@/hooks/useWarmupData';
import { useDatosStream } from '@/hooks/useDatosStream';

const coreNav = [
  { href: '/', label: 'Inicio', icon: Users },
  { href: '/pilotos', label: 'Pilotos', icon: UserCircle },
  { href: '/reservas', label: 'Reservas y Pasajeros', icon: BookOpen },
  { href: '/calendario', label: 'Calendario de Vuelos', icon: Calendar },
  { href: '/analiticas', label: 'Analíticas', icon: BarChart3 },
  { href: '/admin/users', label: 'Usuarios', icon: Users, adminOnly: true },
  { href: '/configuracion', label: 'Configuración', icon: Settings, adminOnly: true },
  { href: '/auditoria', label: 'Auditoría & Logs', icon: ShieldCheck, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Escucha centralizada de eventos SSE en caliente (datos y módulos) y ciclo de vida de red
  useDatosStream();

  // ADR 009: precarga en segundo plano de datos operativos (±15 días) para persistencia offline
  useWarmupData();

  // Escuchar cambios de módulos premium en caliente vía SSE.
  // useEnabledModules() fuerza el re-render cuando el Set de módulos cambia.
  useEnabledModules();

  // Inicializar el estado de módulos desde la API (sustituye al default embebido).
  useEffect(() => {
    initModulesRuntime();
  }, []);

  // Cierra el menú en móvil cuando la ruta cambia
  /* eslint-disable react-hooks/set-state-in-effect -- cierra drawer móvil al navegar; no es estado derivado */
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Drawer móvil: cierre con Escape y bloqueo de scroll del fondo
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const isPublicFullPage = isPublicPath(pathname);

  const premiumMainModules = getEnabledPremiumModules()
    .filter((m) => m.section === 'main')
    .filter((m) => !m.adminOnly || user?.role === 'ADMIN');

  return (
    <AuthGuard>
      {isPublicFullPage ? (
        children
      ) : (
        <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
          
          {/* Cabecera Móvil */}
          <div className="md:hidden flex items-center justify-between bg-slate-900 text-white px-4 py-3 shrink-0 shadow-md z-30 border-b border-slate-800">
            <div className="flex items-center space-x-3 min-w-0">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Abrir menú"
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-95"
              >
                <Menu size={22} />
              </button>
              <WeatherWidget />
            </div>
            <div className="text-lg font-black tracking-tight bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-cyan-300 whitespace-nowrap">ParaglideAdmin</div>
          </div>

          {/* Overlay para Móvil */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-slate-900 text-white flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} border-r border-slate-800`}>
            <div className="p-5 text-2xl font-bold bg-slate-950 flex justify-between items-center border-b border-slate-800/50">
              <span className="bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-cyan-300">ParaglideAdmin</span>
              <button 
                className="md:hidden p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors text-slate-300 hover:text-white active:scale-95" 
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={20} />
              </button>
            </div>
            
            {user && (
              <div className="px-5 py-4 bg-slate-900/50 text-sm border-b border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-inner ring-2 ring-blue-500/20">
                  {user.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-slate-200">{user.nombre}</p>
                  <p className="text-blue-400 text-xs truncate font-medium">{user.role}</p>
                </div>
              </div>
            )}

            <nav className="flex-1 p-3 space-y-1 text-sm font-medium overflow-y-auto custom-scrollbar">
              {coreNav
                .filter((item) => !(item.adminOnly && user?.role !== 'ADMIN'))
                .map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-3 w-full p-2.5 rounded-lg transition-all border ${
                        isActive
                          ? 'bg-linear-to-r from-blue-600/25 to-indigo-600/10 text-blue-300 border-blue-500/30 shadow-sm'
                          : 'border-transparent hover:bg-blue-600/20 hover:text-blue-400'
                      }`}
                    >
                      <item.icon size={20} className={isActive ? 'text-blue-400' : ''} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

              {premiumMainModules.length > 0 && (
                <div className="pt-3 mt-3 border-t border-slate-800/80">
                  <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Features</p>
                </div>
              )}

              {user?.role === 'ADMIN' && (
                <Link
                  key="/admin/modules"
                  href="/admin/modules"
                  className={`flex items-center space-x-3 w-full p-2.5 rounded-lg transition-all border ${
                    pathname === '/admin/modules'
                      ? 'bg-linear-to-r from-blue-600/25 to-indigo-600/10 text-blue-300 border-blue-500/30 shadow-sm'
                      : 'border-transparent hover:bg-blue-600/20 hover:text-blue-400'
                  }`}
                >
                  <ShieldCheck size={20} className="text-blue-400" />
                  <span>Premium Modules</span>
                </Link>
              )}

              {premiumMainModules.map((m) => {
                const isActive = pathname === m.href;
                return (
                  <Link
                    key={m.id}
                    href={m.href}
                    target={m.target}
                    className={`flex items-center space-x-3 w-full p-2.5 rounded-lg transition-all border ${
                      m.featured
                        ? 'bg-linear-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 text-blue-400 hover:text-blue-300 border-blue-500/30 shadow-2xs'
                        : isActive
                          ? 'bg-linear-to-r from-blue-600/25 to-indigo-600/10 text-blue-300 border-blue-500/30 shadow-sm'
                          : 'border-transparent hover:bg-blue-600/20 hover:text-blue-400'
                    }`}
                  >
                    <m.icon size={20} className={m.featured ? 'text-blue-400' : ''} />
                    <div className="flex items-center justify-between w-full">
                      <span>{m.label}</span>
                      {m.badge && (
                        <span className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">{m.badge}</span>
                      )}
                    </div>
                  </Link>
                );
              })}

            </nav>
            <div className="p-4 border-t border-slate-800/80 flex items-center gap-3 bg-slate-950/30">
              <ThemeToggle />
              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="flex-1 flex items-center justify-center space-x-2 p-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-all text-sm font-semibold border border-transparent hover:border-red-500/20"
              >
                <LogOut size={18} />
                <span>Cerrar Sesión</span>
              </button>
              <OutboxBadge />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden overflow-x-hidden">
            <OfflineBanner />
            <main className="flex-1 overflow-auto overflow-x-hidden p-4 md:p-8 relative w-full h-full min-w-0">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>

          {/* Confirmación de cierre de sesión */}
          {showLogoutConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                <h3 className="text-lg font-semibold text-white mb-2">¿Cerrar sesión?</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Se cerrará tu sesión actual en este dispositivo.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { setShowLogoutConfirm(false); logout(); }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-500 transition-all"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AuthGuard>
  );
}
