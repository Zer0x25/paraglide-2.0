"use client";

import { useState } from 'react';
import { 
  MessageSquare, PlusCircle, Edit2, Trash2, Copy, Check, 
  Sparkles, Eye, Smartphone 
} from 'lucide-react';
import { usePlantillas } from '../../hooks/usePlantillas';
import { PlantillaModal } from '../../components/PlantillaModal';
import { PlantillaMensajeDTO, CreatePlantillaMensajePayload } from '@parapente/shared';
import { toast } from 'sonner';
import { withModule } from '@/components/withModule';
import { copyTextToClipboard } from '@/utils/clipboard';

function PlantillasPage() {
  const { plantillas, loading, createPlantilla, updatePlantilla, deletePlantilla, renderTemplate } = usePlantillas();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlantilla, setEditingPlantilla] = useState<PlantillaMensajeDTO | null>(null);

  // Vista previa interactiva
  const [previewPlantilla, setPreviewPlantilla] = useState<PlantillaMensajeDTO | null>(null);
  const [previewText, setPreviewText] = useState<string>('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleOpenEdit = (p: PlantillaMensajeDTO) => {
    setEditingPlantilla(p);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingPlantilla(null);
    setIsModalOpen(true);
  };

  const handleSave = async (data: CreatePlantillaMensajePayload) => {
    if (editingPlantilla) {
      await updatePlantilla(editingPlantilla.id, data);
    } else {
      await createPlantilla(data);
    }
  };

  const handleDelete = (id: number) => {
    toast('¿Eliminar esta plantilla de mensaje?', {
      action: {
        label: 'Sí, eliminar',
        onClick: () => deletePlantilla(id),
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const handleGeneratePreview = async (p: PlantillaMensajeDTO) => {
    setPreviewPlantilla(p);
    const rendered = await renderTemplate(p.cuerpo, {
      nombre: 'Camila Morales',
      fecha: 'Sábado 22 de Agosto',
      hora: '10:30',
      numero_reserva: 'RES-8921',
      link_voucher: 'https://parapente.app/voucher/12',
      link_deslinde: 'https://parapente.app/deslinde/12',
      saldo: '$0 (PAGADO)',
    }, true);
    setPreviewText(rendered as string);
  };

  const copyToClipboard = async (text: string, id: number) => {
    const ok = await copyTextToClipboard(text);
    if (!ok) {
      toast.error('No se pudo copiar, copia manualmente el texto');
      return;
    }
    setCopiedId(id);
    toast.success('Texto copiado al portapapeles');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 relative pb-16 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <MessageSquare className="text-emerald-500 shrink-0" size={28} />
            <span>Plantillas de Mensajes & WhatsApp</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Automatiza comunicaciones con pasajeros (confirmaciones, recordatorios 24h, deslindes y reseñas)
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/20 transition"
        >
          <PlusCircle size={16} />
          <span>Nueva Plantilla</span>
        </button>
      </div>

      {/* Grid de Plantillas & Vista Previa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lista de Plantillas (2 Columnas) */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs">Cargando plantillas de comunicación...</p>
            </div>
          ) : (
            plantillas.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 hover:border-emerald-500/30 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {p.canal}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {p.tipo}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                      {p.titulo}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleGeneratePreview(p)}
                      className="p-2 text-slate-400 hover:text-emerald-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Probar vista previa"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-2 text-slate-400 hover:text-blue-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Editar plantilla"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
                  {p.cuerpo}
                </div>

                <div className="flex justify-between items-center pt-1 text-[11px] text-slate-400">
                  <span>Variables: <strong className="text-slate-600 dark:text-slate-400">{p.variables || 'nombre, fecha, hora'}</strong></span>
                  <button
                    onClick={() => copyToClipboard(p.cuerpo, p.id)}
                    className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                  >
                    {copiedId === p.id ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedId === p.id ? 'Copiado' : 'Copiar Texto'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel Lateral: Simulador de Mensaje en Vivo */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center space-x-2">
              <Smartphone size={18} className="text-emerald-500" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Simulador de Mensaje
              </h3>
            </div>

            {previewPlantilla ? (
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 block">
                  Renderizando: <strong>{previewPlantilla.titulo}</strong>
                </span>

                {/* Burbuja WhatsApp */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4 rounded-3xl text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap shadow-inner leading-relaxed">
                  {previewText}
                </div>

                <p className="text-[10px] text-slate-400 italic">
                  Las variables dinámicas como fecha, hora y links han sido reemplazadas automáticamente con datos de prueba.
                </p>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl">
                <Sparkles size={24} className="mx-auto mb-2 text-slate-400" />
                <p className="text-xs">Haz clic en el ícono del ojo (👁️) en cualquier plantilla para ver cómo la recibirá el pasajero.</p>
              </div>
            )}
          </div>

          {/* Guía de Variables */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-3 text-xs">
            <h4 className="font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Sparkles size={14} /> Variables Disponibles:
            </h4>
            <ul className="space-y-1.5 text-[11px] text-slate-300 font-mono">
              <li><strong className="text-emerald-400">{`{{nombre}}`}</strong>: Nombre del titular o pasajero</li>
              <li><strong className="text-emerald-400">{`{{fecha}}`}</strong>: Fecha del vuelo (ej: 22 de Agosto)</li>
              <li><strong className="text-emerald-400">{`{{hora}}`}</strong>: Hora de presentación</li>
              <li><strong className="text-emerald-400">{`{{link_voucher}}`}</strong>: URL pública del Boarding Pass</li>
              <li><strong className="text-emerald-400">{`{{link_deslinde}}`}</strong>: URL para firma digital</li>
              <li><strong className="text-emerald-400">{`{{saldo}}`}</strong>: Saldo pendiente de pago</li>
              <li><strong className="text-emerald-400">{`{{link_pantalla}}`}</strong>: Enlace del tablero de vuelos en vivo (válido solo el día de hoy, se genera automáticamente)</li>
            </ul>
          </div>

        </div>

      </div>

      {/* Modal de Creación / Edición */}
      <PlantillaModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPlantilla(null);
        }}
        onSuccess={handleSave}
        plantilla={editingPlantilla}
      />

    </div>
  );
}

export default withModule('plantillas', PlantillasPage);
