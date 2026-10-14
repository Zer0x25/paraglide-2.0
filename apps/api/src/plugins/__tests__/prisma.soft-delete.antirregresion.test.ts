import { describe, it, expect } from 'vitest';
import { SOFT_DELETE_MODELS } from '../prisma';

describe('Prisma Plugin — SOFT_DELETE_MODELS (Anti-regresión M-03)', () => {
  it('incluye Tarifa, Promocion y Faq en la lista de modelos con borrado lógico', () => {
    expect(SOFT_DELETE_MODELS).toContain('Tarifa');
    expect(SOFT_DELETE_MODELS).toContain('Promocion');
    expect(SOFT_DELETE_MODELS).toContain('Faq');
  });

  it('mantiene los modelos base esenciales de la aplicación', () => {
    expect(SOFT_DELETE_MODELS).toContain('User');
    expect(SOFT_DELETE_MODELS).toContain('Piloto');
    expect(SOFT_DELETE_MODELS).toContain('Reserva');
    expect(SOFT_DELETE_MODELS).toContain('Pasajero');
    expect(SOFT_DELETE_MODELS).toContain('Vuelo');
    expect(SOFT_DELETE_MODELS).toContain('Pago');
    expect(SOFT_DELETE_MODELS).toContain('Devolucion');
    expect(SOFT_DELETE_MODELS).toContain('Equipo');
    expect(SOFT_DELETE_MODELS).toContain('PlantillaMensaje');
    expect(SOFT_DELETE_MODELS).toContain('ConfiguracionBloque');
    expect(SOFT_DELETE_MODELS).toContain('HorarioBloque');
  });
});
