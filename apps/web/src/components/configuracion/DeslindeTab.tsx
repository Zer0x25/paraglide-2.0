'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PlusCircle, FileText, ChevronDown, ChevronUp, CheckCircle2, Trash2 } from 'lucide-react';
import type { DeslindeVersionDTO, CreateDeslindePayload } from '@parapente/shared';
import typedApi from '@/services/api';
import { Button, Input, Modal, Badge, Spinner, inputClass } from '@/components/ui';

/**
 * Tab de versiones del deslinde (/configuracion).
 * QueryKey EXACTO ['deslindes'] (QUERY_KEY_POR_ENTIDAD['deslinde']).
 *
 * Concurrencia optimista (ADR 004): activar con una `version` obsoleta
 * responde 409 Conflict → recargamos la lista y avisamos al usuario.
 */
export default function DeslindeTab() {
  const queryClient = useQueryClient();

  const { data: versiones = [], isPending, isError } = useQuery({
    queryKey: ['deslindes'],
    queryFn: () => typedApi.deslindes.listar(),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ titulo: '', texto: '' });
  const [toDelete, setToDelete] = useState<DeslindeVersionDTO | null>(null);
  const [expandidas, setExpandidas] = useState<Record<number, boolean>>({});

  // Orden descendente: la versión más reciente primero.
  const ordenadas = [...versiones].sort((a, b) => (b.version ?? 0) - (a.version ?? 0));

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['deslindes'] });

  const crearMutation = useMutation({
    mutationFn: (payload: CreateDeslindePayload) => typedApi.deslindes.crear(payload),
    onSuccess: () => {
      toast.success('Nueva versión de deslinde creada');
      setModalOpen(false);
      invalidar();
    },
    onError: () => toast.error('No se pudo crear la versión'),
  });

  const activarMutation = useMutation({
    mutationFn: ({ id, revision }: { id: number; revision: number }) =>
      typedApi.deslindes.activar(id, { revision }),
    onSuccess: () => {
      toast.success('Versión activada');
      invalidar();
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        // Otro cliente modificó las versiones: recargar estado fresco.
        toast.info('Otro usuario modificó el deslinde. Lista actualizada, intenta nuevamente.');
        invalidar();
      } else {
        toast.error('No se pudo activar la versión');
      }
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => typedApi.deslindes.eliminar(id),
    onSuccess: () => {
      toast.success('Versión eliminada');
      setToDelete(null);
      invalidar();
    },
    onError: () => toast.error('No se pudo eliminar la versión'),
  });

  const handleCrear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.texto.trim()) {
      toast.error('El texto del deslinde es obligatorio');
      return;
    }
    crearMutation.mutate({
      titulo: form.titulo.trim() || undefined,
      texto: form.texto.trim(),
    });
  };

  if (isPending || isError) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)}>
          <PlusCircle size={16} /> Nueva Versión
        </Button>
      </div>

      {ordenadas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-3">
          <FileText className="mx-auto text-slate-300 dark:text-slate-600" size={40} />
          <h3 className="font-bold text-slate-700 dark:text-slate-200">Sin versiones de deslinde</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Crea la primera versión del texto legal que firmarán los pasajeros.
          </p>
          <Button onClick={() => setModalOpen(true)}>
            <PlusCircle size={16} /> Crear versión
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {ordenadas.map((d) => {
            const expandida = !!expandidas[d.id!];
            return (
              <div
                key={d.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 ${
                  d.activa ? 'border-blue-200 dark:border-blue-900/60' : 'border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        Versión {d.version ?? '—'}
                        {d.titulo ? ` — ${d.titulo}` : ''}
                      </p>
                      {d.activa && (
                        <Badge variant="green">
                          <CheckCircle2 size={12} className="mr-1" /> Activa
                        </Badge>
                      )}
                    </div>
                    {d.createdAt && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Creada: {new Date(d.createdAt).toLocaleDateString('es-CL')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {!d.activa && (
                      <Button
                        size="sm"
                        onClick={() =>
                          d.id != null && activarMutation.mutate({ id: d.id, revision: d.revision ?? 0 })
                        }
                        loading={activarMutation.isPending && activarMutation.variables?.id === d.id}
                      >
                        Activar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => d.id != null && setExpandidas((prev) => ({ ...prev, [d.id!]: !expandida }))}
                    >
                      {expandida ? (
                        <>
                          <ChevronUp size={14} /> Ocultar texto
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> Ver texto completo
                        </>
                      )}
                    </Button>
                    {d.activa ? (
                      <span
                        title="No se puede eliminar la versión activa. Activa otra versión primero."
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 cursor-not-allowed"
                        aria-disabled="true"
                      >
                        <Trash2 size={14} />
                      </span>
                    ) : (
                      <Button variant="danger" size="sm" onClick={() => setToDelete(d)} aria-label={`Eliminar versión ${d.version}`}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
                {(expandida || d.activa) && (
                  <p className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {d.texto}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nueva versión */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Versión de Deslinde" size="lg">
        <form onSubmit={handleCrear} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Crear una versión no la activa automáticamente: revisa el texto y luego presiona «Activar».
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Título (opcional)
            </label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej: Actualización por nuevo reglamento"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Texto legal</label>
            <textarea
              className={inputClass}
              rows={10}
              value={form.texto}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
              placeholder="Texto completo del deslinde que verá y firmará el pasajero…"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={crearMutation.isPending}>
              Crear versión
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmar eliminación */}
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Eliminar versión"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => toDelete?.id != null && eliminarMutation.mutate(toDelete.id)}
              loading={eliminarMutation.isPending}
            >
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ¿Seguro que deseas eliminar la versión <strong>{toDelete?.version}</strong>? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  );
}

