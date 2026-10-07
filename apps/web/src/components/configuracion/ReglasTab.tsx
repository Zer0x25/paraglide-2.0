'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import type { ReglaOperativaDTO, UpsertReglaPayload, CategoriaRegla } from '@parapente/shared';
import typedApi from '@/services/api';
import { Button, Input, Modal, Spinner, inputClass } from '@/components/ui';

/** Claves protegidas no borrables (valor editable). Debe coincidir con seed.prod.ts / reglasOperativas.ts */
const CLAVES_PROTEGIDAS = new Set(['puntoDeEncuentro', 'telefonoContacto', 'emailContacto']);

/** Categorías en orden fijo de presentación (headers de sección). */
const CATEGORIAS: { id: CategoriaRegla; label: string }[] = [
  { id: 'AGENDAMIENTO', label: 'Agendamiento' },
  { id: 'SEGURIDAD', label: 'Seguridad' },
  { id: 'CONTACTO', label: 'Contacto' },
  { id: 'PAGOS', label: 'Pagos' },
  { id: 'PUNTO_ENCUENTRO', label: 'Punto de Encuentro' },
];

/** Slugifica un nombre de punto de encuentro para usarlo como clave única. */
const slugClave = (texto: string) =>
  'punto_' +
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

interface ReglaFormState {
  clave: string;
  valor: string;
  descripcion: string;
  esDefault: boolean;
}

const FORM_VACIO: ReglaFormState = { clave: '', valor: '', descripcion: '', esDefault: false };

/**
 * Tab de reglas operativas (/configuracion).
 * QueryKey EXACTO ['reglas-operativas'] (QUERY_KEY_POR_ENTIDAD['regla-operativa']).
 */
export default function ReglasTab() {
  const queryClient = useQueryClient();

  const { data: reglas = [], isPending, isError } = useQuery({
    queryKey: ['reglas-operativas'],
    queryFn: () => typedApi.reglasOperativas.listar(),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClave, setEditingClave] = useState<string | null>(null);
  const [categoriaActual, setCategoriaActual] = useState<CategoriaRegla>('AGENDAMIENTO');
  const [form, setForm] = useState<ReglaFormState>(FORM_VACIO);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['reglas-operativas'] });

  const abrirCrear = (categoria: CategoriaRegla) => {
    setEditingClave(null);
    setCategoriaActual(categoria);
    setForm(FORM_VACIO);
    setModalOpen(true);
  };

  // En la categoría Punto de Encuentro la clave se deriva del nombre (valor),
  // permitiendo múltiples puntos sin fricción de clave manual.
  const esPuntoEncuentro = categoriaActual === 'PUNTO_ENCUENTRO';

  const abrirEditar = (r: ReglaOperativaDTO) => {
    setEditingClave(r.clave);
    setCategoriaActual(r.categoria);
    setForm({ clave: r.clave, valor: r.valor, descripcion: r.descripcion ?? '', esDefault: !!r.esDefault });
    setModalOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: ({ clave, payload }: { clave: string; payload: UpsertReglaPayload }) =>
      typedApi.reglasOperativas.upsert(clave, payload),
    onSuccess: () => {
      toast.success(editingClave ? 'Regla actualizada' : 'Regla creada');
      setModalOpen(false);
      invalidar();
    },
    onError: () => toast.error('No se pudo guardar la regla'),
  });

  const eliminarMutation = useMutation({
    mutationFn: (clave: string) => typedApi.reglasOperativas.eliminar(clave),
    onSuccess: () => {
      toast.success('Regla eliminada');
      invalidar();
    },
    onError: () => toast.error('No se pudo eliminar la regla'),
  });

  const confirmarEliminar = (r: ReglaOperativaDTO) => {
    if (CLAVES_PROTEGIDAS.has(r.clave)) {
      toast.error('No se puede eliminar una regla protegida (edítala en su lugar)');
      return;
    }
    if (window.confirm(`¿Eliminar la regla "${r.valor}" (${r.clave})?`)) {
      eliminarMutation.mutate(r.clave);
    }
  };

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = form.valor.trim();
    if (!valor) {
      toast.error('Completa el valor de la regla');
      return;
    }
    // Punto de Encuentro: al CREAR la clave se deriva del nombre (permite
    // varios puntos). Al EDITAR se conserva la clave original para no crear
    // una regla nueva cada vez que se cambia el nombre.
    const clave = esPuntoEncuentro && !editingClave ? slugClave(valor) : (editingClave ?? form.clave.trim());
    if (!clave) {
      toast.error('El nombre del punto de encuentro no es válido');
      return;
    }
    upsertMutation.mutate({
      clave,
      payload: {
        valor,
        descripcion: form.descripcion.trim() || null,
        categoria: categoriaActual,
        esDefault: esPuntoEncuentro ? form.esDefault : false,
      },
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
    <div className="space-y-6">
      {CATEGORIAS.map(({ id, label }) => {
        const grupo = reglas.filter((r) => r.categoria === id);
        return (
          <section key={id}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</h3>
              <Button variant="ghost" size="sm" onClick={() => abrirCrear(id)}>
                <PlusCircle size={14} /> Agregar
              </Button>
            </div>
            {grupo.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3">
                Sin reglas en esta categoría.
              </p>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {grupo.map((r) => (
                  <div key={r.clave} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 break-all">{r.clave}</p>
                        {r.esDefault && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">
                            Predeterminado
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-100 mt-0.5 break-words">{r.valor}</p>
                      {r.descripcion && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.descripcion}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => abrirEditar(r)}
                        aria-label={`Editar ${r.clave}`}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => confirmarEliminar(r)}
                        aria-label={`Eliminar ${r.clave}`}
                        loading={eliminarMutation.isPending && eliminarMutation.variables === r.clave}
                        disabled={CLAVES_PROTEGIDAS.has(r.clave)}
                        title={CLAVES_PROTEGIDAS.has(r.clave) ? 'Regla protegida — no borrable' : undefined}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Modal crear / editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingClave ? 'Editar Regla' : 'Nueva Regla'}
      >
        <form onSubmit={handleGuardar} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
            <select
              className={inputClass}
              value={categoriaActual}
              onChange={(e) => setCategoriaActual(e.target.value as CategoriaRegla)}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {!esPuntoEncuentro && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Clave (identificador único)
              </label>
              <Input
                value={form.clave}
                onChange={(e) => setForm({ ...form, clave: e.target.value })}
                placeholder="Ej: max_pasajeros_por_vuelo"
                disabled={!!editingClave}
                required
              />
              {editingClave && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  La clave no se puede modificar; crea otra regla si necesitas un identificador distinto.
                </p>
              )}
            </div>
          )}
          {/* A) En Punto de Encuentro la clave se autogenera; al editar la
              mostramos en solo-lectura para transparencia. */}
          {esPuntoEncuentro && editingClave && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Clave (autogenerada)
              </label>
              <input
                value={form.clave}
                readOnly
                className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm font-mono text-slate-600 dark:text-slate-300"
              />
            </div>
          )}
          {/* B) Toggle "Predeterminado" solo para la categoría Punto de Encuentro */}
          {esPuntoEncuentro && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="esDefault"
                checked={form.esDefault}
                onChange={(e) => setForm({ ...form, esDefault: e.target.checked })}
                className="h-4 w-4 text-emerald-600 rounded"
              />
              <label htmlFor="esDefault" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Punto de encuentro predeterminado
              </label>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {esPuntoEncuentro ? 'Nombre del punto de encuentro' : 'Valor'}
            </label>
            <Input
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              placeholder={esPuntoEncuentro ? 'Ej: Zona de Despegue' : 'Ej: 4'}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Qué controla esta regla"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={upsertMutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
