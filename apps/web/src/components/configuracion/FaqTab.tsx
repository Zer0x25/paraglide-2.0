'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PlusCircle, Pencil, Trash2, ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';
import type { FaqDTO, CreateFaqPayload } from '@parapente/shared';
import typedApi from '@/services/api';
import { Button, Input, Modal, Badge, Spinner, inputClass } from '@/components/ui';

interface FaqFormState {
  pregunta: string;
  respuesta: string;
  orden: string;
  publica: boolean;
}

const FORM_VACIO: FaqFormState = { pregunta: '', respuesta: '', orden: '', publica: true };

/**
 * Tab de preguntas frecuentes (/configuracion).
 * QueryKey EXACTO ['faqs'] (QUERY_KEY_POR_ENTIDAD['faq']).
 */
export default function FaqTab() {
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ['faqs'],
    queryFn: () => typedApi.faqs.listar(),
  });
  const faqs = [...(data?.data ?? [])].sort((a, b) => a.orden - b.orden);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FaqDTO | null>(null);
  const [form, setForm] = useState<FaqFormState>(FORM_VACIO);
  const [toDelete, setToDelete] = useState<FaqDTO | null>(null);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['faqs'] });

  const abrirCrear = () => {
    setEditing(null);
    setForm(FORM_VACIO);
    setModalOpen(true);
  };

  const abrirEditar = (f: FaqDTO) => {
    setEditing(f);
    setForm({ pregunta: f.pregunta, respuesta: f.respuesta, orden: String(f.orden), publica: f.publica });
    setModalOpen(true);
  };

  const guardarMutation = useMutation({
    mutationFn: (payload: CreateFaqPayload) =>
      editing?.id != null ? typedApi.faqs.actualizar(editing.id, payload) : typedApi.faqs.crear(payload),
    onSuccess: () => {
      toast.success(editing ? 'Pregunta actualizada' : 'Pregunta creada');
      setModalOpen(false);
      invalidar();
    },
    onError: () => toast.error('No se pudo guardar la pregunta'),
  });

  const togglePublicaMutation = useMutation({
    mutationFn: (f: FaqDTO) => typedApi.faqs.actualizar(f.id!, { publica: !f.publica }),
    onSuccess: () => invalidar(),
    onError: () => toast.error('No se pudo cambiar la publicación'),
  });

  // Reordenar: intercambia el campo `orden` entre vecinos (dos updates atómicos por pares).
  const moverMutation = useMutation({
    mutationFn: async ({ a, b }: { a: FaqDTO; b: FaqDTO }) => {
      await typedApi.faqs.actualizar(a.id!, { orden: b.orden });
      await typedApi.faqs.actualizar(b.id!, { orden: a.orden });
    },
    onSuccess: () => invalidar(),
    onError: () => toast.error('No se pudo reordenar'),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => typedApi.faqs.eliminar(id),
    onSuccess: () => {
      toast.success('Pregunta eliminada');
      setToDelete(null);
      invalidar();
    },
    onError: () => toast.error('No se pudo eliminar la pregunta'),
  });

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pregunta.trim() || !form.respuesta.trim()) {
      toast.error('Completa la pregunta y la respuesta');
      return;
    }
    const ordenNum = Number(form.orden);
    guardarMutation.mutate({
      pregunta: form.pregunta.trim(),
      respuesta: form.respuesta.trim(),
      orden: Number.isFinite(ordenNum) ? ordenNum : faqs.length + 1,
      publica: form.publica,
    });
  };

  const mover = (index: number, direccion: -1 | 1) => {
    const b = faqs[index + direccion];
    const a = faqs[index];
    if (!a || !b) return;
    moverMutation.mutate({ a, b });
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
        <Button onClick={abrirCrear}>
          <PlusCircle size={16} /> Nueva Pregunta
        </Button>
      </div>

      {faqs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-3">
          <HelpCircle className="mx-auto text-slate-300 dark:text-slate-600" size={40} />
          <h3 className="font-bold text-slate-700 dark:text-slate-200">Sin preguntas frecuentes</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Las preguntas publicadas aparecen en la sección pública de ayuda.
          </p>
          <Button onClick={abrirCrear}>
            <PlusCircle size={16} /> Crear pregunta
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {faqs.map((f, index) => (
            <div key={f.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                    {index + 1}
                  </span>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{f.pregunta}</p>
                  <Badge variant={f.publica ? 'blue' : 'gray'}>{f.publica ? 'Publicada' : 'Oculta'}</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">{f.respuesta}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => mover(index, -1)}
                  disabled={index === 0 || moverMutation.isPending}
                  aria-label={`Subir "${f.pregunta}"`}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => mover(index, 1)}
                  disabled={index === faqs.length - 1 || moverMutation.isPending}
                  aria-label={`Bajar "${f.pregunta}"`}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => togglePublicaMutation.mutate(f)}
                  disabled={togglePublicaMutation.isPending}
                >
                  {f.publica ? 'Ocultar' : 'Publicar'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => abrirEditar(f)} aria-label={`Editar "${f.pregunta}"`}>
                  <Pencil size={14} />
                </Button>
                <Button variant="danger" size="sm" onClick={() => setToDelete(f)} aria-label={`Eliminar "${f.pregunta}"`}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear / editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Pregunta' : 'Nueva Pregunta'}>
        <form onSubmit={handleGuardar} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pregunta</label>
            <Input
              value={form.pregunta}
              onChange={(e) => setForm({ ...form, pregunta: e.target.value })}
              placeholder="Ej: ¿Qué debo llevar al vuelo?"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Respuesta</label>
            <textarea
              className={inputClass}
              rows={4}
              value={form.respuesta}
              onChange={(e) => setForm({ ...form, respuesta: e.target.value })}
              placeholder="Respuesta clara y breve para los pasajeros"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Orden (menor = primero)
              </label>
              <Input
                type="number"
                min={0}
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: e.target.value })}
                placeholder={String(faqs.length + 1)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={form.publica}
                onChange={(e) => setForm({ ...form, publica: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
              Publicada
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardarMutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmar eliminación */}
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Eliminar pregunta"
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
          ¿Seguro que deseas eliminar la pregunta <strong>{toDelete?.pregunta}</strong>?
        </p>
      </Modal>
    </div>
  );
}
