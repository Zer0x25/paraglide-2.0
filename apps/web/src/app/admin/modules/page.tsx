"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { ShieldCheck, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { ALL_MODULE_IDS } from '@/modules/runtime';
import { apiRaw } from '@/services/api';
import { OfflinePageGuard } from '@/components/OfflinePageGuard';

interface ModuleStatus {
  id: string;
  enabled: boolean;
}

export default function AdminModulesPage() {
  const { user } = useAuthStore();
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchModules = async () => {
    try {
      // El interceptor devuelve response.data; el cast alinea el tipado de axios.
      const data = (await apiRaw.get('/admin/modules')) as unknown as { modules: ModuleStatus[] };
      setModules(data.modules);
    } catch (err: unknown) {
      // 403 (no admin): salimos del modo loading para mostrar el mensaje.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 403) console.error(err);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect -- fetch inicial de módulos al montar; no es estado derivado */
  useEffect(() => {
    fetchModules();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = (id: string) => {
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const enabled = modules.filter((m) => m.enabled).map((m) => m.id);
      const data = (await apiRaw.put('/admin/modules', { enabled })) as unknown as { modules: ModuleStatus[] };
      setModules(data.modules);
      toast.success('Módulos actualizados en caliente (reload automático en todos los clientes).');
    } catch {
      toast.error('Error al guardar módulos');
    } finally {
      setSaving(false);
    }
  };

  // Solo bloquear una vez que sabemos quién es el usuario y NO es admin.
  if (user && user.role !== 'ADMIN') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-600 mt-0.5" />
          <div>
            <h2 className="font-bold text-amber-800">Acceso restringido</h2>
            <p className="text-amber-700 text-sm">
              Esta sección es exclusiva para administradores.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex items-center gap-2 text-slate-500">
        <RefreshCw className="animate-spin" size={16} />
        Cargando módulos...
      </div>
    );
  }

  return (
    <OfflinePageGuard pageTitle="Gestión de Módulos">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-blue-600" />
          <h1 className="text-2xl font-bold">Gestión de Módulos Premium</h1>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw className="animate-spin" size={16} />
              Guardando...
            </>
          ) : (
            <>
              <Save size={16} />
              Guardar cambios (en caliente)
            </>
          )}
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Activa o desactiva módulos premium. Los cambios se aplican en caliente vía SSE
        y se persisten en <code className="bg-slate-100 px-1.5 py-0.5 rounded">modules.config.json</code>
        del repositorio.
      </p>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase">
                Módulo
              </th>
              <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {([...ALL_MODULE_IDS] as string[])
              .map((id): ModuleStatus => {
                const m = modules.find((x) => x.id === id);
                return m ?? { id, enabled: false };
              })
              .map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <span className="font-medium capitalize">{m.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(m.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full text-xs font-medium transition ${
                        m.enabled
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          m.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      <span className="sr-only">toggle</span>
                      <span className="absolute inset-0 flex items-center justify-center">
                        {m.enabled ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
          </table>
        </div>
      </div>

      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-800">
        <AlertCircle className="inline mr-2" size={16} />
        Los cambios aplicados aquí se propagan en caliente a todos los clientes
        conectados vía SSE. Para hacerlos persistentes entre reinicios, el estado
        inicial se lee de <code className="font-bold">modules.config.json</code> en
        el repositorio.
      </div>
      </div>
    </OfflinePageGuard>
  );
}
