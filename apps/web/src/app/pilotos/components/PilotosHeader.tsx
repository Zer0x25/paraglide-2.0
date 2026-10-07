"use client";

import { PlusCircle, Search } from 'lucide-react';

interface PilotosHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onOpenNuevoModal: () => void;
}

export function PilotosHeader({
  searchTerm,
  onSearchChange,
  onOpenNuevoModal,
}: PilotosHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Gestión de Pilotos</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
          Administración de pilotos, licencias y disponibilidad
        </p>
      </div>
      <div className="flex flex-col w-full sm:w-auto sm:flex-row gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            id="pilotos-search-input"
            name="searchPilotos"
            aria-label="Buscar pilotos por nombre, RUT o teléfono"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar nombre, RUT, teléfono..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none backdrop-blur transition"
          />
        </div>
        <button 
          onClick={onOpenNuevoModal}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl transition shadow-md font-bold text-sm cursor-pointer"
        >
          <PlusCircle size={18} />
          <span>Nuevo Piloto</span>
        </button>
      </div>
    </div>
  );
}
