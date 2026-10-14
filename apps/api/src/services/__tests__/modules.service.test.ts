import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import {
  getEnabledModules,
  getModuleStatus,
  setEnabledModules,
  ALL_MODULE_IDS,
} from '../modules.service';
import { broadcastModulos } from '../eventos.service';

vi.mock('../eventos.service', () => ({
  broadcastModulos: vi.fn(),
  subscribe: vi.fn(),
}));

describe('modules.service — antirregresión A-05', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setEnabledModules filtra IDs no permitidos, persiste a disco y emite broadcastModulos', () => {
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const resultado = setEnabledModules(['equipos', 'pantalla', 'modulo_invalido']);

    // 1. Debe haber filtrado 'modulo_invalido'
    const enabled = getEnabledModules();
    expect(enabled).toContain('equipos');
    expect(enabled).toContain('pantalla');
    expect(enabled).not.toContain('modulo_invalido');

    // 2. Debe escribir en disco el JSON formateado
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('modules.config.json'),
      expect.stringContaining('"modules"'),
      'utf-8',
    );

    // 3. Debe haber emitido el evento SSE broadcastModulos
    expect(broadcastModulos).toHaveBeenCalledWith(expect.arrayContaining(['equipos', 'pantalla']));

    // 4. getModuleStatus mapea todos los módulos oficiales
    const status = getModuleStatus();
    expect(status.length).toBe(ALL_MODULE_IDS.length);
    const equiposStatus = status.find((m) => m.id === 'equipos');
    const reportesStatus = status.find((m) => m.id === 'reportes');
    expect(equiposStatus?.enabled).toBe(true);
    expect(reportesStatus?.enabled).toBe(false);

    writeSpy.mockRestore();
  });
});
