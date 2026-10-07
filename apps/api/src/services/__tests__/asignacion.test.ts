import { describe, it, expect } from 'vitest';
import { ordenarPilotosParaAsignacion, PilotoOrden } from '../vuelos.service';

// Helper: cuenta cuántas veces quedó primero cada id tras N ordenamientos (para validar que el empate es aleatorio)
function conteoPrimero(pilotos: PilotoOrden[], iteraciones = 200): Record<number, number> {
  const conteo: Record<number, number> = {};
  for (let i = 0; i < iteraciones; i++) {
    const ordenado = ordenarPilotosParaAsignacion(pilotos);
    const primero = ordenado[0].id;
    conteo[primero] = (conteo[primero] || 0) + 1;
  }
  return conteo;
}

describe('ordenarPilotosParaAsignacion', () => {
  it('prioriza el piloto con menor número de prioridad (1 = máxima) aunque venga después en el array', () => {
    const pilotos: PilotoOrden[] = [
      { id: 2, prioridad: 3, categoria: 'JUNIOR' },
      { id: 1, prioridad: 1, categoria: 'MASTER' },
      { id: 3, prioridad: 2, categoria: 'SENIOR' },
    ];
    const ordenado = ordenarPilotosParaAsignacion(pilotos);
    expect(ordenado.map(p => p.id)).toEqual([1, 3, 2]);
  });

  it('al empatar prioridad, elige la categoría de menor número (MASTER=1 > SENIOR=2 > JUNIOR=3)', () => {
    const pilotos: PilotoOrden[] = [
      { id: 2, prioridad: 1, categoria: 'SENIOR' },
      { id: 1, prioridad: 1, categoria: 'MASTER' },
      { id: 3, prioridad: 1, categoria: 'JUNIOR' },
    ];
    const ordenado = ordenarPilotosParaAsignacion(pilotos);
    expect(ordenado.map(p => p.id)).toEqual([1, 2, 3]);
  });

  it('categoría desconocida va al final del empate de prioridad', () => {
    const pilotos: PilotoOrden[] = [
      { id: 2, prioridad: 1, categoria: 'DESCONOCIDA' },
      { id: 1, prioridad: 1, categoria: 'MASTER' },
    ];
    const ordenado = ordenarPilotosParaAsignacion(pilotos);
    expect(ordenado[0].id).toBe(1);
  });

  it('empate total (misma prioridad y categoría) se resuelve al azar y no por orden de inserción', () => {
    const pilotos: PilotoOrden[] = [
      { id: 1, prioridad: 1, categoria: 'MASTER' },
      { id: 2, prioridad: 1, categoria: 'MASTER' },
    ];
    // Con orden determinista por inserción, el id 1 ganaría siempre (100%).
    // Con azar, ambos deben aparecer primero una fracción significativa de las veces.
    const conteo = conteoPrimero(pilotos, 500);
    expect(conteo[1]).toBeGreaterThan(100);
    expect(conteo[2]).toBeGreaterThan(100);
  });

  it('no muta el array original', () => {
    const original: PilotoOrden[] = [
      { id: 2, prioridad: 3, categoria: 'JUNIOR' },
      { id: 1, prioridad: 1, categoria: 'MASTER' },
    ];
    const copia = [...original];
    ordenarPilotosParaAsignacion(original);
    expect(original).toEqual(copia);
  });
});
