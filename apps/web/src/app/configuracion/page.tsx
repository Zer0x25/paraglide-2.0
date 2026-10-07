'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import TarifasTab from '@/components/configuracion/TarifasTab';
import PromocionesTab from '@/components/configuracion/PromocionesTab';
import DeslindeTab from '@/components/configuracion/DeslindeTab';
import FaqTab from '@/components/configuracion/FaqTab';
import ReglasTab from '@/components/configuracion/ReglasTab';
import EmpresaTab from '@/components/configuracion/EmpresaTab';
import NotificacionesTab from '@/components/configuracion/NotificacionesTab';

type TabId = 'tarifas' | 'promociones' | 'deslinde' | 'faq' | 'reglas' | 'empresa' | 'notificaciones';

const TABS: { id: TabId; label: string }[] = [
  { id: 'tarifas', label: 'Tarifas' },
  { id: 'promociones', label: 'Promociones' },
  { id: 'deslinde', label: 'Deslinde' },
  { id: 'faq', label: 'FAQ' },
  { id: 'reglas', label: 'Reglas' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'notificaciones', label: 'Notificaciones' },
];

export default function ConfiguracionPage() {
  const { user } = useAuthStore();
  const [tabActivo, setTabActivo] = useState<TabId>('tarifas');

  // Guard admin client-side: solo bloquear cuando user ya cargó,
  // para no flashear "acceso restringido" durante la hidratación.
  if (user && user.role !== 'ADMIN') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-600 mt-0.5" />
          <div>
            <h2 className="font-bold text-amber-800">Acceso restringido</h2>
            <p className="text-amber-700 text-sm">Esta sección es exclusiva para administradores.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header glass */}
      <div className="bg-white/40 dark:bg-slate-900/40 p-5 md:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          Configuración del Sistema
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm md:text-base">
          Tarifas, promociones, textos legales y reglas operativas de la escuela
        </p>
      </div>

      {/* Tabs estilo reservas */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex space-x-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTabActivo(tab.id)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                tabActivo === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="pt-2">
          {tabActivo === 'tarifas' && <TarifasTab />}
          {tabActivo === 'promociones' && <PromocionesTab />}
          {tabActivo === 'deslinde' && <DeslindeTab />}
          {tabActivo === 'faq' && <FaqTab />}
          {tabActivo === 'reglas' && <ReglasTab />}
          {tabActivo === 'empresa' && <EmpresaTab />}
          {tabActivo === 'notificaciones' && <NotificacionesTab />}
        </div>
      </div>
    </div>
  );
}
