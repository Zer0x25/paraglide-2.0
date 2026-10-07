import { PlusCircle } from 'lucide-react';

interface ReservasHeaderProps {
  onOpenModal: () => void;
}

export function ReservasHeader({ onOpenModal }: ReservasHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Gestión de Reservas y Pasajeros
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
          Control de pasajeros, estado de pagos y deslindes digitales en pista
        </p>
      </div>
      <button 
        onClick={onOpenModal}
        className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl transition shadow-md font-bold text-sm cursor-pointer"
      >
        <PlusCircle size={18} />
        <span>Nueva Reserva</span>
      </button>
    </div>
  );
}
