import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { withModule } from '../withModule';
import * as onlineHook from '@/hooks/useOnlineStatus';
import * as registry from '@/modules/registry';

describe('withModule (ADR 003 y ADR 009)', () => {
  const MockComponent = () => <div data-testid="modulo-contenido">Contenido del Módulo</div>;

  it('renderiza componentes de módulos offline (equipos) normalmente incluso estando offline', () => {
    vi.spyOn(registry, 'isModuleEnabled').mockReturnValue(true);
    vi.spyOn(onlineHook, 'useOnlineStatus').mockReturnValue(false);

    const Wrapped = withModule('equipos', MockComponent);
    render(<Wrapped />);

    expect(screen.getByTestId('modulo-contenido')).toBeInTheDocument();
    expect(
      screen.queryByText(/Temporalmente fuera de servicio en modo offline/i)
    ).not.toBeInTheDocument();
  });

  it('renderiza componentes de módulos offline (plantillas) normalmente incluso estando offline', () => {
    vi.spyOn(registry, 'isModuleEnabled').mockReturnValue(true);
    vi.spyOn(onlineHook, 'useOnlineStatus').mockReturnValue(false);

    const Wrapped = withModule('plantillas', MockComponent);
    render(<Wrapped />);

    expect(screen.getByTestId('modulo-contenido')).toBeInTheDocument();
    expect(
      screen.queryByText(/Temporalmente fuera de servicio en modo offline/i)
    ).not.toBeInTheDocument();
  });

  it('muestra OfflinePageGuard para módulos no preparados para offline (reportes) cuando está sin conexión', () => {
    vi.spyOn(registry, 'isModuleEnabled').mockReturnValue(true);
    vi.spyOn(onlineHook, 'useOnlineStatus').mockReturnValue(false);

    const Wrapped = withModule('reportes', MockComponent);
    render(<Wrapped />);

    expect(screen.queryByTestId('modulo-contenido')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Temporalmente fuera de servicio en modo offline/i)
    ).toBeInTheDocument();
  });
});
