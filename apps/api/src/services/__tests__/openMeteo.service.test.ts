import { describe, it, expect } from 'vitest';
import { gradosADireccion } from '../openMeteo.service';

describe('openMeteo.service - gradosADireccion', () => {
  it('debería retornar null para entradas inválidas (null, undefined, NaN)', () => {
    expect(gradosADireccion(null)).toBeNull();
    expect(gradosADireccion(undefined)).toBeNull();
    expect(gradosADireccion(NaN)).toBeNull();
  });

  it('debería mapear correctamente los grados principales a 8 direcciones', () => {
    expect(gradosADireccion(0)).toBe('N');
    expect(gradosADireccion(45)).toBe('NE');
    expect(gradosADireccion(90)).toBe('E');
    expect(gradosADireccion(135)).toBe('SE');
    expect(gradosADireccion(180)).toBe('S');
    expect(gradosADireccion(225)).toBe('SO');
    expect(gradosADireccion(270)).toBe('O');
    expect(gradosADireccion(315)).toBe('NO');
  });

  it('debería manejar correctamente el límite de 360 grados como N', () => {
    expect(gradosADireccion(360)).toBe('N');
  });

  it('debería manejar correctamente redondeos sobre sectores de 45°', () => {
    // 0 = N (337.5 to 22.5)
    expect(gradosADireccion(20)).toBe('N');
    expect(gradosADireccion(340)).toBe('N');

    // 45 = NE (22.5 to 67.5)
    expect(gradosADireccion(25)).toBe('NE');
    expect(gradosADireccion(65)).toBe('NE');

    // 90 = E (67.5 to 112.5)
    expect(gradosADireccion(70)).toBe('E');
    expect(gradosADireccion(110)).toBe('E');

    // 135 = SE (112.5 to 157.5)
    expect(gradosADireccion(115)).toBe('SE');
    expect(gradosADireccion(155)).toBe('SE');

    // 180 = S (157.5 to 202.5)
    expect(gradosADireccion(160)).toBe('S');
    expect(gradosADireccion(200)).toBe('S');

    // 225 = SO (202.5 to 247.5)
    expect(gradosADireccion(205)).toBe('SO');
    expect(gradosADireccion(245)).toBe('SO');

    // 270 = O (247.5 to 292.5)
    expect(gradosADireccion(250)).toBe('O');
    expect(gradosADireccion(290)).toBe('O');

    // 315 = NO (292.5 to 337.5)
    expect(gradosADireccion(295)).toBe('NO');
    expect(gradosADireccion(335)).toBe('NO');
  });

  it('debería manejar correctamente grados negativos', () => {
    // -45 should be NO (315)
    expect(gradosADireccion(-45)).toBe('NO');
    // -90 should be O (270)
    expect(gradosADireccion(-90)).toBe('O');
    // -360 should be N
    expect(gradosADireccion(-360)).toBe('N');
  });

  it('debería manejar correctamente grados mayores a 360', () => {
    // 360 + 45 = 405 -> NE
    expect(gradosADireccion(405)).toBe('NE');
    // 720 -> N
    expect(gradosADireccion(720)).toBe('N');
    // 360 + 90 = 450 -> E
    expect(gradosADireccion(450)).toBe('E');
  });
});
