'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PlusCircle, Pencil, Trash2, Percent } from 'lucide-react';
import type { PromocionDTO, CreatePromocionPayload, TipoDescuento } from '@parapente/shared';
import typedApi from '@/services/api';
import { Button, Input, Modal, Badge, Spinner, inputClass } from '@/components/ui';
import { formatCLP } from '@/utils/format';

interface PromocionFormState {
  nombre: string;
  descripcion: string;
  tipoDescuento: TipoDescuento;
  valor: string;
  fechaInicio: string;
  fechaFin: string;
  activa: boolean;
}

const FORM_VACIO: PromocionFormState = {
  nombre: '',
  descripcion: '',
  tipoDescuento: 'PORCENTAJE',
  valor: '',
  fechaInicio: '',
  fechaFin: '',
  activa: true,
};

/** Convierte string|Date|null a value de <input type="date"> sin corrimiento de zona horaria. */
function toDateInput(v: string | Date | null | undefined): string {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  const d = new Date(v);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Estado de vigencia calculado client-side (badge). */
function estadoPromocion(p: PromocionDTO): { label: string; variant: 'green' | 'red' | 'gray' | 'amber' } {
  if (!p.activa) return { label: 'Inactiva', variant: 'gray' };
  const hoy = new Date();
  const inicio = p.fechaInicio ? new Date(p.fechaInicio) : null;
  const fin = p.fechaFin ? new Date(p.fechaFin) : null;
  if (inicio && hoy < inicio) return { label: 'Programada', variant: 'amber' };
  if (fin && hoy > fin) return { label: 'Vencida', variant: 'red' };
  return { label: 'Vigente', variant: 'green' };
}

function resumenDescuento(p: PromocionDTO): string {
  return p.tipoDescuento === 'PORCENTAJE' ? `${p.valor}% de descuento` : `${formatCLP(p.valor)} de descuento por vuelo`;
}

/**
 * Tab de administración de promociones (/configuracion).
 * QueryKey EXACTO ['promociones'] (QUERY_KEY_POR_ENTIDAD['promociones']).
 */
export default function PromocionesTab() {
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ['promociones'],
    queryFn: () => typedApi.promociones.listar(),
  });
  const promociones = data?.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromocionDTO | null>(null);
  const [form, setForm] = useState<PromocionFormState>(FORM_VACIO);
  const [toDelete, setToDelete] = useState<PromocionDTO | null>(null);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['promociones'] });

  const abrirCrear = () => {
    setEditing(null);
    setForm(FORM_VACIO);
    setModalOpen(true);
  };

  const abrirEditar = (p: PromocionDTO) => {
    setEditing(p);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      tipoDescuento: p.tipoDescuento,
      valor: String(p.valor),
      fechaInicio: toDateInput(p.fechaInicio),
      fechaFin: toDateInput(p.fechaFin),
      activa: p.activa,
    });
    setModalOpen(true);
  };

  const guardarMutation = useMutation({
    mutationFn: (payload: CreatePromocionPayload) =>
      editing?.id != null
        ? typedApi.promociones.actualizar(editing.id, payload)
        : typedApi.promociones.crear(payload),
    onSuccess: () => {
      toast.success(editing ? 'Promoción actualizada' : 'Promoción creada');
      setModalOpen(false);
      invalidar();
    },
    onError: () => toast.error('No se pudo guardar la promoción'),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => typedApi.promociones.eliminar(id),
    onSuccess: () => {
      toast.success('Promoción eliminada');
      setToDelete(null);
      invalidar();
    },
    onError: () => toast.error('No se pudo eliminar la promoción'),
  });

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = Number(form.valor);
    if (!form.nombre.trim() || !Number.isFinite(valor) || valor <= 0) {
      toast.error('Completa el nombre y un valor de descuento válido');
      return;
    }
    if (form.tipoDescuento === 'PORCENTAJE' && valor > 100) {
      toast.error('El porcentaje no puede superar 100%');
      return;
    }
    guardarMutation.mutate({
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      tipoDescuento: form.tipoDescuento,
      valor,
      fechaInicio: form.fechaInicio || null,
      fechaFin: form.fechaFin || null,
      activa: form.activa,
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
        <Button onClick={abrirCrear}>
          <PlusCircle size={16} /> Nueva Promoción
        </Button>
      </div>

      {promociones.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-3">
          <Percent className="mx-auto text-slate-300 dark:text-slate-600" size={40} />
          <h3 className="font-bold text-slate-700 dark:text-slate-200">Sin promociones todavía</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Crea descuentos por porcentaje o monto fijo para tus clientes.
          </p>
          <Button onClick={abrirCrear}>
            <PlusCircle size={16} /> Crear promoción
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {promociones.map((p) => {
            const estado = estadoPromocion(p);
            return (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.nombre}</p>
                    <Badge variant={estado.variant}>{estado.label}</Badge>
                    <Badge variant="blue">{resumenDescuento(p)}</Badge>
                  </div>
                  {(p.fechaInicio || p.fechaFin) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {p.fechaInicio ? toDateInput(p.fechaInicio) : '—'} → {p.fechaFin ? toDateInput(p.fechaFin) : '—'}
                    </p>
                  )}
                  {p.descripcion && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.descripcion}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => abrirEditar(p)} aria-label={`Editar ${p.nombre}`}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setToDelete(p)} aria-label={`Eliminar ${p.nombre}`}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear / editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Promoción' : 'Nueva Promoción'}
      >
        <form onSubmit={handleGuardar} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Black Friday"
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
              placeholder="Descripción opcional"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de descuento
              </label>
              <select
                className={inputClass}
                value={form.tipoDescuento}
                onChange={(e) => setForm({ ...form, tipoDescuento: e.target.value as TipoDescuento })}
              >
                <option value="PORCENTAJE">Porcentaje (%)</option>
                <option value="MONTO_FIJO">Monto fijo (CLP)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {form.tipoDescuento === 'PORCENTAJE' ? 'Valor (%)' : 'Descuento por vuelo (CLP)'}
              </label>
              <Input
                type="number"
                min={0}
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder={form.tipoDescuento === 'PORCENTAJE' ? '20' : '20000'}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fecha inicio (opcional)
              </label>
              <Input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fecha fin (opcional)
              </label>
              <Input
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm({ ...form, activa: e.target.checked })}
              className="h-4 w-4 accent-blue-600"
            />
            Promoción activa
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
        title="Eliminar promoción"
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
          ¿Seguro que deseas eliminar la promoción <strong>{toDelete?.nombre}</strong>? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  );
}
