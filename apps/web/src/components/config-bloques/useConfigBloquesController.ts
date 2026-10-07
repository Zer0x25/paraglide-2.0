"use client";

import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { toast } from 'sonner';
import { isConflictError } from '../../hooks/useDomainMutation';
import { numerarConfigs } from '@parapente/shared';
import { ConfiguracionBloque, Horario } from './types';

export function useConfigBloquesController(isOpen: boolean) {
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionBloque[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingVersion, setEditingVersion] = useState(0);

  const [nombre, setNombre] = useState('');
  const [tipoConfig, setTipoConfig] = useState<'RANGO' | 'INDEFINIDO' | 'EXACTA'>('INDEFINIDO');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [fechaExacta, setFechaExacta] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  const [horariosForm, setHorariosForm] = useState<Horario[]>([{ horaInicio: '09:00', horaFin: '10:00' }]);
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false);

  const fetchConfiguraciones = async () => {
    try {
      setLoading(true);
      const data = await api.configuracion.listar() as unknown as ConfiguracionBloque[];
      setConfiguraciones(data);
    } catch (error) {
      console.error('Error fetching configuraciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatearFechaCalendario = (fecha: string | null | undefined): string => {
    if (!fecha) return '';
    const dia = fecha.slice(0, 10);
    const [y, m, d] = dia.split('-');
    return `${d}-${m}-${y}`;
  };

  /* eslint-disable react-hooks/set-state-in-effect -- fetch al abrir modal; setState desde fetch es intencional */
  useEffect(() => {
    if (!isOpen) return;
    setIsModalOpen(false);
    let cancelled = false;
    api.configuracion.listar()
      .then((data) => { if (!cancelled) setConfiguraciones(data as unknown as ConfiguracionBloque[]); })
      .catch((error) => { if (!cancelled) console.error('Error fetching configuraciones:', error); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const numeros = useMemo(() => numerarConfigs(configuraciones), [configuraciones]);
  const activas = useMemo(
    () => configuraciones.filter(c => !c.archivada),
    [configuraciones]
  );
  const archivadas = useMemo(
    () => configuraciones.filter(c => c.archivada),
    [configuraciones]
  );

  const resetForm = () => {
    setNombre('');
    setTipoConfig('INDEFINIDO');
    setFechaInicio('');
    setFechaFin('');
    setFechaExacta('');
    setBloqueado(false);
    setHorariosForm([{ horaInicio: '09:00', horaFin: '10:00' }]);
    setEditingId(null);
  };

  const handleOpenModalParaCrear = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenModalParaEditar = (config: ConfiguracionBloque) => {
    setEditingId(config.id);
    setEditingVersion(config.version ?? 0);
    setNombre(config.nombre);
    setBloqueado(config.bloqueado);
    setHorariosForm(config.horarios.length > 0 ? config.horarios : [{ horaInicio: '09:00', horaFin: '10:00' }]);

    if (config.fechaExacta) {
      setTipoConfig('EXACTA');
      setFechaExacta(config.fechaExacta.split('T')[0]);
      setFechaInicio('');
      setFechaFin('');
    } else if (config.fechaInicio || config.fechaFin) {
      setTipoConfig('RANGO');
      setFechaInicio(config.fechaInicio ? config.fechaInicio.split('T')[0] : '');
      setFechaFin(config.fechaFin ? config.fechaFin.split('T')[0] : '');
      setFechaExacta('');
    } else {
      setTipoConfig('INDEFINIDO');
      setFechaInicio('');
      setFechaFin('');
      setFechaExacta('');
    }

    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nombre,
        bloqueado,
        fechaExacta: tipoConfig === 'EXACTA' && fechaExacta ? fechaExacta.slice(0, 10) : undefined,
        fechaInicio: tipoConfig === 'RANGO' && fechaInicio ? fechaInicio.slice(0, 10) : undefined,
        fechaFin: tipoConfig === 'RANGO' && fechaFin ? fechaFin.slice(0, 10) : undefined,
        horarios: bloqueado ? [] : horariosForm
      };

      if (editingId) {
        await api.configuracion.actualizar(editingId, {
          ...payload,
          version: editingVersion,
          fechaExacta: tipoConfig === 'EXACTA' && fechaExacta ? fechaExacta.slice(0, 10) : null,
          fechaInicio: tipoConfig === 'RANGO' && fechaInicio ? fechaInicio.slice(0, 10) : null,
          fechaFin: tipoConfig === 'RANGO' && fechaFin ? fechaFin.slice(0, 10) : null,
        } as unknown as Record<string, unknown>);
      } else {
        await api.configuracion.crear(payload as unknown as Record<string, unknown>);
      }
      setIsModalOpen(false);
      fetchConfiguraciones();
      toast.success(editingId ? 'Configuración actualizada.' : 'Configuración creada.');
    } catch (error: unknown) {
      console.error('Error guardando configuración:', error);
      if (isConflictError(error)) {
        toast.error('La configuración cambió en otro dispositivo. Recargando...');
        fetchConfiguraciones();
      } else {
        {
          const msg = error !== null && typeof error === 'object' && 'response' in error ? (error as { response?: { data?: { error?: unknown } } }).response?.data?.error : undefined;
          toast.error(typeof msg === 'string' ? msg : 'Error al guardar la configuración.');
        }
      }
    }
  };

  const eliminarConfiguracion = (id: number) => {
    toast('¿Deseas eliminar esta regla de configuración?', {
      description: 'Se archivará. El calendario histórico conservará su configuración.',
      action: {
        label: 'Archivar',
        onClick: async () => {
          try {
            await api.configuracion.eliminar(id);
            fetchConfiguraciones();
            toast.success('Regla archivada. El historial del calendario se conserva.');
          } catch (error: unknown) {
            {
              const msg2 = error !== null && typeof error === 'object' && 'response' in error ? (error as { response?: { data?: { error?: unknown } } }).response?.data?.error : undefined;
              toast.error(typeof msg2 === 'string' ? msg2 : 'Error al eliminar la regla.');
            }
          }
        }
      },
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  return {
    configuraciones,
    loading,
    isModalOpen,
    setIsModalOpen,
    editingId,
    nombre,
    setNombre,
    tipoConfig,
    setTipoConfig,
    fechaInicio,
    setFechaInicio,
    fechaFin,
    setFechaFin,
    fechaExacta,
    setFechaExacta,
    bloqueado,
    setBloqueado,
    horariosForm,
    setHorariosForm,
    mostrarArchivadas,
    setMostrarArchivadas,
    numeros,
    activas,
    archivadas,
    formatearFechaCalendario,
    handleOpenModalParaCrear,
    handleOpenModalParaEditar,
    handleSubmit,
    eliminarConfiguracion,
  };
}
