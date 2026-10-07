import { useState } from 'react';
import { toast } from 'sonner';
import type { PilotoDTO } from '@parapente/shared';
import { usePilotos } from '../../../hooks/usePilotos';
import { typedApiOutbox } from '../../../services/apiOutbox';
import { isQueuedError } from '../../../hooks/useDomainMutation';

export type PilotoConId = PilotoDTO & { id: number };

export function usePilotosCrud() {
  const { pilotos, loading, refetch: fetchPilotos } = usePilotos();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<string>('prioridad');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    nombre: '',
    rutDni: '',
    email: '',
    telefono: '',
    activo: true,
    peso: '',
    tieneLicencia: false,
    numeroLicencia: '',
    fechaVencimientoLicencia: '',
    prioridad: '1',
    categoria: 'MASTER',
    pesoMaximoPasajero: '110',
    tarifaPorVuelo: '30000',
  });

  const handleOpenModalParaCrear = () => {
    setEditingId(null);
    setFormData({
      nombre: '',
      rutDni: '',
      email: '',
      telefono: '',
      activo: true,
      peso: '',
      tieneLicencia: false,
      numeroLicencia: '',
      fechaVencimientoLicencia: '',
      prioridad: '1',
      categoria: 'MASTER',
      pesoMaximoPasajero: '110',
      tarifaPorVuelo: '30000',
    });
    setIsModalOpen(true);
  };

  const handleOpenModalParaEditar = (piloto: PilotoDTO) => {
    if (piloto.id == null) return;
    setEditingId(piloto.id);
    setFormData({
      nombre: piloto.nombre,
      rutDni: piloto.rutDni || '',
      email: piloto.email || '',
      telefono: piloto.telefono || '',
      activo: piloto.activo,
      peso: piloto.peso ? piloto.peso.toString() : '',
      tieneLicencia: piloto.tieneLicencia,
      numeroLicencia: piloto.numeroLicencia || '',
      fechaVencimientoLicencia: piloto.fechaVencimientoLicencia
        ? String(piloto.fechaVencimientoLicencia).slice(0, 10)
        : '',
      prioridad: piloto.prioridad ? piloto.prioridad.toString() : '1',
      categoria: piloto.categoria || 'MASTER',
      pesoMaximoPasajero: piloto.pesoMaximoPasajero ? piloto.pesoMaximoPasajero.toString() : '110',
      tarifaPorVuelo: piloto.tarifaPorVuelo ? piloto.tarifaPorVuelo.toString() : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: formData.nombre,
        rutDni: formData.rutDni || undefined,
        email: formData.email || undefined,
        telefono: formData.telefono || undefined,
        activo: formData.activo,
        peso: formData.peso ? parseInt(formData.peso) : null,
        tieneLicencia: formData.tieneLicencia,
        numeroLicencia: formData.tieneLicencia ? formData.numeroLicencia || null : null,
        fechaVencimientoLicencia:
          formData.tieneLicencia && formData.fechaVencimientoLicencia
            ? new Date(formData.fechaVencimientoLicencia)
            : null,
        prioridad: parseInt(formData.prioridad) || 1,
        categoria: formData.categoria || 'MASTER',
        pesoMaximoPasajero: formData.pesoMaximoPasajero ? parseFloat(formData.pesoMaximoPasajero) : 110,
        tarifaPorVuelo: parseInt(formData.tarifaPorVuelo, 10) || 0,
      };

      if (editingId) {
        await typedApiOutbox.pilotos.actualizar(editingId, payload as Partial<PilotoDTO>);
      } else {
        await typedApiOutbox.pilotos.crear(payload as Partial<PilotoDTO>);
      }

      setIsModalOpen(false);
      fetchPilotos();
      toast.success(editingId ? 'Piloto actualizado con éxito.' : 'Piloto creado con éxito.');
    } catch (error: unknown) {
      console.error('Error guardando piloto:', error);
      if (isQueuedError(error) || (error as { queued?: boolean })?.queued) {
        toast.info('Sin conexión: los datos del piloto se enviarán automáticamente al reconectar');
        setIsModalOpen(false);
        return;
      }
      toast.error('Error al guardar el piloto.');
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toSortKey = (p: PilotoConId): string | number => {
    const raw = (p as unknown as Record<string, unknown>)[sortField];
    if (typeof raw === 'string') return raw.toLowerCase();
    if (typeof raw === 'number') return raw;
    if (raw == null) return '';
    return String(raw).toLowerCase();
  };

  const sortedPilotos = [...(Array.isArray(pilotos) ? (pilotos as PilotoConId[]) : [])].sort(
    (a: PilotoConId, b: PilotoConId) => {
      const aVal = toSortKey(a);
      const bVal = toSortKey(b);
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }
  );

  const filteredPilotos = sortedPilotos.filter((p: PilotoConId) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return [p.nombre, p.email, p.telefono, p.rutDni, p.categoria, String(p.prioridad)].some(
      (v) => v != null && String(v).toLowerCase().includes(q)
    );
  });

  return {
    pilotos,
    loading,
    fetchPilotos,
    searchTerm,
    setSearchTerm,
    sortField,
    sortDirection,
    handleSort,
    filteredPilotos,
    isModalOpen,
    setIsModalOpen,
    editingId,
    formData,
    setFormData,
    handleOpenModalParaCrear,
    handleOpenModalParaEditar,
    handleSubmit,
  };
}
