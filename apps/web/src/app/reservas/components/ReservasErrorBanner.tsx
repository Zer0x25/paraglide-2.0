import { AlertTriangle } from 'lucide-react';

export interface ReservasErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

export function ReservasErrorBanner({ error, onRetry }: ReservasErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <AlertTriangle className="text-red-500 shrink-0" size={20} />
        <span className="text-sm">
          <strong>Error de conexión:</strong> No se pudo conectar con el servidor backend.
        </span>
      </div>
      <button
        onClick={onRetry}
        className="bg-red-600 text-white px-3 py-1 text-xs font-bold rounded-xl hover:bg-red-700 transition cursor-pointer"
      >
        Reintentar
      </button>
    </div>
  );
}
