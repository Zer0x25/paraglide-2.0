'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Save } from 'lucide-react';
import type { UpdateEmpresaPayload } from '@parapente/shared';
import typedApi from '@/services/api';
import { Button, Input, Spinner } from '@/components/ui';
import { isConflictError } from '@/hooks/useDomainMutation';

/**
 * Tab Empresa (/configuracion): ficha singleton de la escuela.
 * Concurrencia optimista (ADR 004): PUT con version → 409 recarga estado.
 */
const FORM_VACIO = {
  nombre: '',
  slogan: '',
  telefono: '',
  email: '',
  direccion: '',
  horario: '',
  logoUrl: '',
  instagram: '',
  whatsapp: '',
  facebook: '',
};

export default function EmpresaTab() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: ['empresa'],
    queryFn: () => typedApi.empresa.obtener(),
  });

  const [form, setForm] = useState(FORM_VACIO);

  /* eslint-disable react-hooks/set-state-in-effect -- hidrata formulario controlado desde query empresa; no derivable en render */
  useEffect(() => {
    if (data) {
      setForm({
        nombre: data.nombre ?? '',
        slogan: data.slogan ?? '',
        telefono: data.telefono ?? '',
        email: data.email ?? '',
        direccion: data.direccion ?? '',
        horario: data.horario ?? '',
        logoUrl: data.logoUrl ?? '',
        instagram: ((data.redesSociales as unknown as Record<string, unknown> | null | undefined)?.instagram as string | undefined) ?? '',
        whatsapp: ((data.redesSociales as unknown as Record<string, unknown> | null | undefined)?.whatsapp as string | undefined) ?? '',
        facebook: ((data.redesSociales as unknown as Record<string, unknown> | null | undefined)?.facebook as string | undefined) ?? '',
      });
    }
  }, [data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const guardarMutation = useMutation({
    mutationFn: (payload: UpdateEmpresaPayload) =>
      typedApi.empresa.actualizar(payload, data?.version ?? 0),
    onSuccess: () => {
      toast.success('Datos de la empresa guardados.');
      queryClient.invalidateQueries({ queryKey: ['empresa'] });
      queryClient.invalidateQueries({ queryKey: ['empresa-publico'] });
    },
    onError: (error: unknown) => {
      if (isConflictError(error)) {
        toast.info('La ficha cambió en otro dispositivo. Recargando datos...');
        queryClient.invalidateQueries({ queryKey: ['empresa'] });
      } else {
        toast.error('No se pudo guardar la ficha de empresa.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }
    const redes: Record<string, string> = {};
    if (form.instagram.trim()) redes.instagram = form.instagram.trim();
    if (form.whatsapp.trim()) redes.whatsapp = form.whatsapp.trim();
    if (form.facebook.trim()) redes.facebook = form.facebook.trim();

    guardarMutation.mutate({
      nombre: form.nombre.trim(),
      ...(form.slogan.trim() && { slogan: form.slogan.trim() }),
      ...(form.telefono.trim() && { telefono: form.telefono.trim() }),
      ...(form.email.trim() && { email: form.email.trim() }),
      ...(form.direccion.trim() && { direccion: form.direccion.trim() }),
      ...(form.horario.trim() && { horario: form.horario.trim() }),
      ...(form.logoUrl.trim() && { logoUrl: form.logoUrl.trim() }),
      ...(Object.keys(redes).length > 0 && { redesSociales: redes }),
    });
  };

  const set = (campo: keyof typeof FORM_VACIO) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  if (isPending || isError) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Building2 size={16} /> Identidad de la escuela
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Estos datos aparecen en la pantalla pública, vouchers y comunicaciones. Dejar vacío mantiene los valores por defecto.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Nombre *</label>
            <Input value={form.nombre} onChange={set('nombre')} placeholder="Ej: Parapente School" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Slogan</label>
            <Input value={form.slogan} onChange={set('slogan')} placeholder="Ej: Vuela seguro, vuela con nosotros" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Teléfono</label>
            <Input value={form.telefono} onChange={set('telefono')} placeholder="+56 9 1234 5678" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Email</label>
            <Input type="email" value={form.email} onChange={set('email')} placeholder="contacto@escuela.cl" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Dirección</label>
            <Input value={form.direccion} onChange={set('direccion')} placeholder="Pista de despegue..." />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Horario de atención</label>
            <Input value={form.horario} onChange={set('horario')} placeholder="Lun-Dom 09:00-19:00" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">URL del logo</label>
            <Input value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://..." />
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Redes sociales</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input value={form.instagram} onChange={set('instagram')} placeholder="Instagram (@usuario)" />
            <Input value={form.whatsapp} onChange={set('whatsapp')} placeholder="WhatsApp (+56...)" />
            <Input value={form.facebook} onChange={set('facebook')} placeholder="Facebook (página)" />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={guardarMutation.isPending}>
            <Save size={16} /> Guardar
          </Button>
        </div>
      </div>
    </form>
  );
}
