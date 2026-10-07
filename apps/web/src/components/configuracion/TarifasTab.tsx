'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PlusCircle, Pencil, Trash2, Tag } from 'lucide-react';
import type { TarifaDTO, CreateTarifaPayload } from '@parapente/shared';
import typedApi from '@/services/api';
import { Button, Input, Modal, Badge, Spinner, inputClass } from '@/components/ui';
import { formatCLP } from '@/utils/format';

interface TarifaFormState {
  nombre: string;
  descripcion: string;
  precio: string;
  activo: boolean;
}

const FORM_VACIO: TarifaFormState = { nombre: '', descripcion: '', precio: '', activo: true };

/**
 * Tab de administración de tarifas (/configuracion).
 * QueryKey EXACTO ['tarifas']: coincide con QUERY_KEY_POR_ENTIDAD['tarifa']
 * de @parapente/shared para que la revalidación quirúrgica SSE funcione.
 */
export default function TarifasTab() {
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ['tarifas'],
    queryFn: () => typedApi.tarifas.listar(),
  });
  const tarifas = data?.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TarifaDTO | null>(null);
  const [form, setForm] = useState<TarifaFormState>(FORM_VACIO);
  const [toDelete, setToDelete] = useState<TarifaDTO | null>(null);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['tarifas'] });

  const abrirCrear = () => {
    setEditing(null);
    setForm(FORM_VACIO);
    setModalOpen(true);
  };

  const abrirEditar = (t: TarifaDTO) => {
    setEditing(t);
    setForm({
      nombre: t.nombre,
      descripcion: t.descripcion ?? '',
      precio: String(t.precio),
      activo: t.activo,
    });
    setModalOpen(true);
  };

  const guardarMutation = useMutation({
    mutationFn: (payload: CreateTarifaPayload) =>
      editing?.id != null
        ? typedApi.tarifas.actualizar(editing.id, payload)
        : typedApi.tarifas.crear(payload),
    onSuccess: () => {
      toast.success(editing ? 'Tarifa actualizada' : 'Tarifa creada');
      setModalOpen(false);
      invalidar();
    },
    onError: () => toast.error('No se pudo guardar la tarifa'),
  });

  const toggleMutation = useMutation({
    mutationFn: (tarifa: TarifaDTO) =>
      typedApi.tarifas.actualizar(tarifa.id!, { activo: !tarifa.activo }),
    onSuccess: () => invalidar(),
    onError: () => toast.error('No se pudo cambiar el estado de la tarifa'),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => typedApi.tarifas.eliminar(id),
    onSuccess: () => {
      toast.success('Tarifa eliminada');
      setToDelete(null);
      invalidar();
    },
    onError: () => toast.error('No se pudo eliminar la tarifa'),
  });

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    const precio = Number(form.precio);
    if (!form.nombre.trim() || !Number.isFinite(precio) || precio <= 0) {
      toast.error('Completa el nombre y un precio válido');
      return;
    }
    guardarMutation.mutate({
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio,
      activo: form.activo,
    });
  };

  if (isPending || isError) {
    // isError también muestra spinner: evita pintar el estado vacío si la
    // consulta falla (el toast global/reporta el error).
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
          <PlusCircle size={16} /> Nueva Tarifa
        </Button>
      </div>

      {tarifas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-3">
          <Tag className="mx-auto text-slate-300 dark:text-slate-600" size={40} />
          <h3 className="font-bold text-slate-700 dark:text-slate-200">Sin tarifas todavía</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Crea tu primera tarifa para que esté disponible al reservar.
          </p>
          <Button onClick={abrirCrear}>
            <PlusCircle size={16} /> Crear tarifa
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {tarifas.map((t) => (
            <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{t.nombre}</p>
                  <Badge variant={t.activo ? 'green' : 'gray'}>{t.activo ? 'Activa' : 'Inactiva'}</Badge>
                </div>
                {t.descripcion && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-blue-600 dark:text-blue-400 text-sm mr-auto sm:mr-4">
                  {formatCLP(t.precio)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleMutation.mutate(t)}
                  disabled={toggleMutation.isPending}
                >
                  {t.activo ? 'Desactivar' : 'Activar'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => abrirEditar(t)} aria-label={`Editar ${t.nombre}`}>
                  <Pencil size={14} />
                </Button>
                <Button variant="danger" size="sm" onClick={() => setToDelete(t)} aria-label={`Eliminar ${t.nombre}`}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear / editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Tarifa' : 'Nueva Tarifa'}
      >
        <form onSubmit={handleGuardar} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Vuelo Tándem Standard"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción opcional de la tarifa"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Precio (CLP)</label>
            <Input
              type="number"
              min={0}
              step={1000}
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              placeholder="80000"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              className="h-4 w-4 accent-blue-600"
            />
            Tarifa activa (visible al reservar)
          </label>
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
        title="Eliminar tarifa"
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
          ¿Seguro que deseas eliminar la tarifa <strong>{toDelete?.nombre}</strong>? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  );
}
