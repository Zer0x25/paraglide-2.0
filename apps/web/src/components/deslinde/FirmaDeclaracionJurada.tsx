import { FileText } from 'lucide-react';

interface FirmaDeclaracionJuradaProps {
  textoLegal: string;
}

export function FirmaDeclaracionJurada({ textoLegal }: FirmaDeclaracionJuradaProps) {
  return (
    <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-2xl text-xs space-y-2">
      <div className="flex items-center space-x-2 font-bold text-sm">
        <FileText size={16} />
        <span>Términos y Declaración Jurada</span>
      </div>
      <p>{textoLegal}</p>
    </div>
  );
}
