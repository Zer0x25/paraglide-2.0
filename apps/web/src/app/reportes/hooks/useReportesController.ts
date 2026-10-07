"use client";

import { useState } from 'react';
import { apiRaw as api } from '../../../services/api';
import { toast } from 'sonner';
import { ManifiestoDiarioDTO, ReporteLiquidacionesDTO, dateKeyLocal } from '@parapente/shared';
import { useQuery } from '@tanstack/react-query';

export function useReportesController() {
  const [activeTab, setActiveTab] = useState<'MANIFIESTO' | 'LIQUIDACIONES'>('MANIFIESTO');

  // Estado Manifiesto
  const [fechaManifiesto, setFechaManifiesto] = useState(() => dateKeyLocal());
  const [searchManifiesto, setSearchManifiesto] = useState('');

  const { data: manifiestoData, isLoading: loadingManifiesto } = useQuery<ManifiestoDiarioDTO>({
    queryKey: ['reportes', 'manifiesto', fechaManifiesto],
    queryFn: async () => {
      const res = (await api.get(`/reportes/manifiesto?fecha=${fechaManifiesto}`)) as unknown as Record<string, unknown>;
      if (res && typeof res === 'object' && 'vuelos' in res) return res as unknown as ManifiestoDiarioDTO;
      if (res && typeof res === 'object' && 'manifiesto' in res) return (res as { manifiesto: unknown }).manifiesto as ManifiestoDiarioDTO;
      if (res && typeof res === 'object' && 'data' in res) return (res as { data: unknown }).data as ManifiestoDiarioDTO;
      return res as ManifiestoDiarioDTO;
    },
    enabled: activeTab === 'MANIFIESTO',
  });

  // Estado Liquidaciones
  const [targetMonth, setTargetMonth] = useState(() => new Date().getMonth());
  const [targetYear, setTargetYear] = useState(() => new Date().getFullYear());
  const [expandedPilotoId, setExpandedPilotoId] = useState<number | null>(null);

  const { data: liquidacionesData, isLoading: loadingLiquidaciones } = useQuery<ReporteLiquidacionesDTO>({
    queryKey: ['reportes', 'liquidaciones', targetMonth, targetYear],
    queryFn: async () => {
      const res = (await api.get(`/reportes/liquidaciones?mes=${targetMonth}&year=${targetYear}`)) as unknown as Record<string, unknown>;
      if (res && typeof res === 'object' && 'pilotos' in res) return res as unknown as ReporteLiquidacionesDTO;
      if (res && typeof res === 'object' && 'liquidaciones' in res) return (res as { liquidaciones: unknown }).liquidaciones as ReporteLiquidacionesDTO;
      if (res && typeof res === 'object' && 'data' in res) return (res as { data: unknown }).data as ReporteLiquidacionesDTO;
      return res as ReporteLiquidacionesDTO;
    },
    enabled: activeTab === 'LIQUIDACIONES',
  });

  const setFechaRelativa = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setFechaManifiesto(dateKeyLocal(d));
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  const tryNativeShare = async (blob: Blob, filename: string, mime: string, title: string): Promise<boolean> => {
    if (!(blob instanceof Blob)) return false;
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
      return false;
    }
    try {
      const file = new File([blob], filename, { type: mime });
      if (!navigator.canShare({ files: [file] })) return false;
      await navigator.share({ title, files: [file] });
      return true;
    } catch (err) {
      if (err instanceof TypeError) return false;
      const name = (err as Error)?.name;
      if (name === 'AbortError') return true;
      return false;
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = (await api.get(`/reportes/manifiesto/pdf?fecha=${fechaManifiesto}`, {
        responseType: 'blob',
      })) as unknown as Blob;

      const filename = `manifiesto_${fechaManifiesto}.pdf`;
      const mime = 'application/pdf';

      if (blob instanceof Blob) {
        const shared = await tryNativeShare(blob, filename, mime, filename);
        if (shared) {
          toast.success('Manifiesto PDF descargado exitosamente');
          return;
        }
      }

      const safeBlob = blob instanceof Blob ? blob : new Blob([blob as unknown as BlobPart], { type: mime });
      triggerDownload(safeBlob, filename);

      toast.success('Manifiesto PDF descargado exitosamente');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo descargar el manifiesto PDF');
    }
  };

  // Compat: la UI anterior llamaba a window.print; ahora descarga PDF real.
  const handlePrint = handleDownloadPdf;

  const handleDownloadExcel = async () => {
    try {
      const blob = (await api.get(`/reportes/liquidaciones/xlsx?mes=${targetMonth}&year=${targetYear}`, {
        responseType: 'blob',
      })) as unknown as Blob;

      const filename = `liquidaciones_${targetYear}_${String(targetMonth + 1).padStart(2, '0')}.xlsx`;
      const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      if (blob instanceof Blob) {
        const shared = await tryNativeShare(blob, filename, mime, filename);
        if (shared) {
          toast.success('Planilla Excel descargada exitosamente');
          return;
        }
      }

      const safeBlob = blob instanceof Blob ? blob : new Blob([blob as unknown as BlobPart], { type: mime });
      triggerDownload(safeBlob, filename);

      toast.success('Planilla Excel descargada exitosamente');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo descargar el archivo Excel');
    }
  };

  // Legacy alias (csv) — se mantiene por compatibilidad pero ahora apunta a xlsx si se llama
  const handleDownloadCsv = handleDownloadExcel;

  const vuelosFiltrados = (manifiestoData?.vuelos || []).filter(v => {
    if (!searchManifiesto.trim()) return true;
    const q = searchManifiesto.toLowerCase().trim();
    const legacy = v as { pasajeroRutDni?: string };
    return (
      (v.pilotoNombre || '').toLowerCase().includes(q) ||
      (v.pasajeroNombre || '').toLowerCase().includes(q) ||
      (v.pasajeroRut && v.pasajeroRut.toLowerCase().includes(q)) ||
      (legacy.pasajeroRutDni?.toLowerCase().includes(q) ?? false) ||
      (v.reservaNumero && v.reservaNumero.toLowerCase().includes(q))
    );
  });

  return {
    activeTab,
    setActiveTab,
    fechaManifiesto,
    setFechaManifiesto,
    searchManifiesto,
    setSearchManifiesto,
    manifiestoData,
    loadingManifiesto,
    vuelosFiltrados,
    setFechaRelativa,
    handlePrint,
    handleDownloadPdf,
    targetMonth,
    setTargetMonth,
    targetYear,
    setTargetYear,
    expandedPilotoId,
    setExpandedPilotoId,
    liquidacionesData,
    loadingLiquidaciones,
    handleDownloadCsv,
    handleDownloadExcel,
  };
}
