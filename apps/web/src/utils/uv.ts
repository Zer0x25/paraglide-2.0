// Helper de clasificación de índice UV según umbrales de la OMS.
// El backend expone `pronostico.indiceUv: number | null`.

export interface ClasificacionUv {
  nivel: 'BAJO' | 'MODERADO' | 'ALTO' | 'MUY_ALTO' | 'EXTREMO' | 'DESCONOCIDO';
  etiqueta: string; // texto en español, ej 'Moderado'
  color: string; // clase Tailwind de color de texto, ej 'text-yellow-500'
  bg: string; // clase Tailwind de fondo, ej 'bg-yellow-50 dark:bg-yellow-950/40'
  border: string; // ej 'border-yellow-200 dark:border-yellow-900/50'
  recomendacion: string; // texto para pasajeros
}

const DESCONOCIDO: ClasificacionUv = {
  nivel: 'DESCONOCIDO',
  etiqueta: '—',
  color: 'text-slate-400',
  bg: 'bg-slate-50 dark:bg-slate-800/50',
  border: 'border-slate-200 dark:border-slate-700/60',
  recomendacion: 'No hay datos de índice UV en este momento.',
} as const;

const BAJO: ClasificacionUv = {
  nivel: 'BAJO',
  etiqueta: 'Bajo',
  color: 'text-green-500',
  bg: 'bg-green-50 dark:bg-green-950/40',
  border: 'border-green-200 dark:border-green-900/50',
  recomendacion: 'Protección solar mínima necesaria; disfruta del vuelo con tranquilidad.',
} as const;

const MODERADO: ClasificacionUv = {
  nivel: 'MODERADO',
  etiqueta: 'Moderado',
  color: 'text-yellow-500',
  bg: 'bg-yellow-50 dark:bg-yellow-950/40',
  border: 'border-yellow-200 dark:border-yellow-900/50',
  recomendacion: 'Lleva protector solar y gorra; ideal para fotos en el aire.',
} as const;

const ALTO: ClasificacionUv = {
  nivel: 'ALTO',
  etiqueta: 'Alto',
  color: 'text-orange-500',
  bg: 'bg-orange-50 dark:bg-orange-950/40',
  border: 'border-orange-200 dark:border-orange-900/50',
  recomendacion:
    'Usa protector solar SPF 50+, gorra, gafas de sol e hidrátate con frecuencia.',
} as const;

const MUY_ALTO: ClasificacionUv = {
  nivel: 'MUY_ALTO',
  etiqueta: 'Muy alto',
  color: 'text-red-500',
  bg: 'bg-red-50 dark:bg-red-950/40',
  border: 'border-red-200 dark:border-red-900/50',
  recomendacion:
    'Usa protector solar SPF 50+, gorra, gafas de sol e hidrátate con frecuencia.',
} as const;

const EXTREMO: ClasificacionUv = {
  nivel: 'EXTREMO',
  etiqueta: 'Extremo',
  color: 'text-purple-600 dark:text-purple-400',
  bg: 'bg-purple-50 dark:bg-purple-950/40',
  border: 'border-purple-200 dark:border-purple-900/50',
  recomendacion:
    'Protección SPF 50+ obligatoria, gorra y gafas. Evita exposición prolongada: busca sombra entre vuelos y reaplica protector cada 2h.',
} as const;

export function clasificarUv(uv: number | null | undefined): ClasificacionUv {
  if (uv == null || Number.isNaN(uv)) {
    return DESCONOCIDO;
  }

  switch (true) {
    case uv >= 11:
      return EXTREMO;
    case uv >= 8:
      return MUY_ALTO;
    case uv >= 6:
      return ALTO;
    case uv >= 3:
      return MODERADO;
    case uv >= 0:
      return BAJO;
    default:
      return DESCONOCIDO;
  }
}
