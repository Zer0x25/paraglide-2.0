"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { apiRaw as api } from '../../services/api';
import { Database, Zap, AlertTriangle, CheckCircle2, UserCog, ShieldCheck } from 'lucide-react';
import { withModule } from '@/components/withModule';

function getApiErrorMessage(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    const r = (error as { response?: { data?: { message?: unknown } }; message?: unknown }).response?.data?.message;
    if (typeof r === 'string' && r) return r;
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return '';
}

function DevToolsPage() {
  const [isResetting, setIsResetting] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const [simConfig, setSimConfig] = useState({
    months: 12,
    flightsPerDay: 5,
    pilotsCount: 10
  });

  const handleResetDB = async () => {
    if (!confirm('🚨 PELIGRO: Esto borrará TODOS los datos de la base de datos (vuelos, reservas, pilotos, pagos, gastos, equipos, clima, auditoría, plantillas, tokens). El admin se recrea automáticamente. ¿Estás completamente seguro?')) {
      return;
    }

    setIsResetting(true);
    try {
      await api.delete('/dev/reset-db');
      toast.success('Base de datos borrada. Admin recreado: admin@parapente.com / admin123');
    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiErrorMessage(error) || 'Error al borrar la base de datos');
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreateAdmin = async () => {
    setIsCreatingAdmin(true);
    try {
      await api.post('/dev/create-admin');
      toast.success('Administrador creado: admin@parapente.com / admin123');
    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiErrorMessage(error) || 'Error al crear el administrador');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`¿Generar datos para ${simConfig.months} meses a razón de ${simConfig.flightsPerDay} vuelos/día? Esto puede tardar varios segundos.`)) {
      return;
    }

    setIsSimulating(true);
    try {
      const res = await api.post<{ message?: string }>('/dev/simulate', simConfig);
      toast.success((res as { message?: string })?.message || 'Simulación completada con éxito.');
    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiErrorMessage(error) || 'Error al ejecutar la simulación');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center">
          <Zap className="mr-3 text-amber-500" />
          Herramientas de Desarrollo
        </h1>
        <p className="text-slate-500 mt-2">
          Panel exclusivo para entornos locales (solo administradores). Permite regenerar la base de datos
          completa y poblarla con todos los módulos del sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Zona Peligrosa */}
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 p-4 flex items-center">
            <AlertTriangle className="text-red-500 mr-2" />
            <h2 className="font-bold text-red-700">Zona de Peligro</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-6">
              Borra permanentemente TODAS las tablas (usuarios, pilotos, reservas, vuelos, pasajeros, pagos,
              gastos, equipos, mantenimientos, clima, bloques de horario, auditoría, plantillas y tokens) y
              recrea el admin automáticamente. Úsala para limpiar el entorno antes de correr una nueva simulación.
            </p>
            <button 
              onClick={handleResetDB}
              disabled={isResetting || isSimulating}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
            >
              {isResetting ? (
                <span>Borrando DB...</span>
              ) : (
                <>
                  <Database className="mr-2" size={20} />
                  Resetear Base de Datos
                </>
              )}
            </button>
          </div>
        </div>

        {/* Crear Administrador */}
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-100 p-4 flex items-center">
            <UserCog className="text-emerald-600 mr-2" />
            <h2 className="font-bold text-emerald-700">Usuario Administrador</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-6">
              Tras un reset, el usuario admin desaparece. Recrea el administrador
              <code className="ml-1 font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">admin@parapente.com / admin123</code>.
            </p>
            <button 
              onClick={handleCreateAdmin}
              disabled={isCreatingAdmin}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
            >
              {isCreatingAdmin ? (
                <span>Creando...</span>
              ) : (
                <>
                  <ShieldCheck className="mr-2" size={20} />
                  Crear Administrador
                </>
              )}
            </button>
          </div>
        </div>

        {/* Simulador Masivo */}
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden md:col-span-2">
          <div className="bg-blue-50 border-b border-blue-100 p-4 flex items-center">
            <Zap className="text-blue-500 mr-2" />
            <h2 className="font-bold text-blue-700">Simulador de Datos Masivos</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-5">
              Puebla el sistema completo: <strong>pilotos</strong>, <strong>reservas</strong>, <strong>pasajeros</strong>,
              <strong> vuelos</strong>, <strong>pagos</strong> (coherentes con el estado de pago), <strong>gastos</strong>,
              <strong> condiciones de pista</strong> históricas, <strong>equipos</strong> con <strong>mantenimientos</strong>,
              <strong> bloques de horario</strong> y las <strong>plantillas de WhatsApp</strong>.
            </p>
            <form onSubmit={handleSimulate}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Periodo a simular (meses)
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="60"
                    required
                    value={simConfig.months}
                    onChange={e => setSimConfig({...simConfig, months: parseInt(e.target.value) || 1})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-slate-500 mt-1">Ej: 12 = 1 año de datos.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Densidad (promedio vuelos/día)
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="100"
                    required
                    value={simConfig.flightsPerDay}
                    onChange={e => setSimConfig({...simConfig, flightsPerDay: parseInt(e.target.value) || 1})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-slate-500 mt-1">Reservas/vuelos por cada día del periodo.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Pilotos a generar
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="50"
                    required
                    value={simConfig.pilotsCount}
                    onChange={e => setSimConfig({...simConfig, pilotsCount: parseInt(e.target.value) || 10})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-slate-500 mt-1">Instructores para distribuir los vuelos.</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-100 text-sm">
                <span className="font-semibold text-slate-700">Volumen estimado:</span> ~{simConfig.months * 30 * simConfig.flightsPerDay} vuelos/reservas + datos de clima, gastos, equipos y configuración.
              </div>

              <button 
                type="submit"
                disabled={isSimulating || isResetting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
              >
                {isSimulating ? (
                  <span className="animate-pulse">Generando e insertando registros...</span>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2" size={20} />
                    Ejecutar Simulación
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withModule('dev', DevToolsPage);