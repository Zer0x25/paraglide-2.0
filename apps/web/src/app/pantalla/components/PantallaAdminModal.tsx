"use client";

import { Link2, X, Copy, RotateCcw, Save } from 'lucide-react';
import { PantallaLinkInfo } from '../hooks/usePantallaController';

interface PantallaAdminModalProps {
  isAdmin: boolean;
  showAdminPanel: boolean;
  dailyLink: PantallaLinkInfo | null;
  tvLink: PantallaLinkInfo | null;
  copiedKey: string;
  onOpenAdminPanel: () => void;
  onCloseAdminPanel: () => void;
  onCopyLink: (key: string, text: string) => void;
  onRegenerateLink: (tipo: 'DIARIO' | 'TV') => void;
  onSaveTvToBrowser: () => void;
  formatExpiry: (iso: string) => string;
}

export function PantallaAdminModal({
  isAdmin,
  showAdminPanel,
  dailyLink,
  tvLink,
  copiedKey,
  onOpenAdminPanel,
  onCloseAdminPanel,
  onCopyLink,
  onRegenerateLink,
  onSaveTvToBrowser,
  formatExpiry,
}: PantallaAdminModalProps) {
  return (
    <>
      {isAdmin && !showAdminPanel && (
        <button
          onClick={onOpenAdminPanel}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-2xl text-xs font-black text-cyan-300 shadow-2xl backdrop-blur-md transition"
        >
          <Link2 size={15} />
          Enlaces de acceso
        </button>
      )}

      {showAdminPanel && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onCloseAdminPanel}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black uppercase tracking-wider text-white text-sm flex items-center gap-2">
                <Link2 size={16} className="text-cyan-400" />
                Enlaces de Acceso al Tablero
              </h3>
              <button
                onClick={onCloseAdminPanel}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                    Enlace del día (WhatsApp)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Válido hasta {dailyLink ? formatExpiry(dailyLink.expiraEn) : '—'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => dailyLink && onCopyLink('daily', dailyLink.url)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                    title="Copiar enlace del día"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => onRegenerateLink('DIARIO')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                    title="Renovar (invalida el actual)"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
              <p className="text-[11px] font-mono text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 break-all">
                {dailyLink?.url || 'Cargando…'}
              </p>
              {copiedKey === 'daily' && (
                <p className="text-[10px] font-black text-emerald-400">¡Enlace copiado!</p>
              )}

              <div className="border-t border-slate-800 pt-3 mt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                      Enlace TV (pantalla de la escuela)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Válido hasta {tvLink ? formatExpiry(tvLink.expiraEn) : '—'} • se renueva con el uso
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => tvLink && onCopyLink('tv', tvLink.url)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                      title="Copiar enlace TV"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={onSaveTvToBrowser}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                      title="Guardar en este navegador (esta pantalla)"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => onRegenerateLink('TV')}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                      title="Renovar (invalida el actual)"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] font-mono text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 break-all mt-2">
                  {tvLink?.url || 'Cargando…'}
                </p>
                {copiedKey === 'tv' && (
                  <p className="text-[10px] font-black text-emerald-400">¡Enlace copiado!</p>
                )}
                {copiedKey === 'tv-saved' && (
                  <p className="text-[10px] font-black text-emerald-400">
                    Guardado: este navegador ya puede abrir el tablero en /pantalla sin enlace.
                  </p>
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-600 leading-relaxed">
              El enlace del día se genera automáticamente y caduca a las 23:59. Compártelo por WhatsApp el día del vuelo
              (disponible como variable {'{{link_pantalla}}'} en Plantillas). El enlace TV caduca a los 7 días de uso.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
