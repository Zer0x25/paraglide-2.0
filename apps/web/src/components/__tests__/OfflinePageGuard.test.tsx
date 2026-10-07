import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflinePageGuard } from '../OfflinePageGuard';
import * as onlineHook from '@/hooks/useOnlineStatus';

describe('OfflinePageGuard (ADR 009)', () => {
  it('renderiza los hijos normalmente cuando hay conexión online', () => {
    vi.spyOn(onlineHook, 'useOnlineStatus').mockReturnValue(true);

    render(
      <OfflinePageGuard pageTitle="Auditoría">
        <div data-testid="contenido-protegido">Contenido de la página</div>
      </OfflinePageGuard>
    );

    expect(screen.getByTestId('contenido-protegido')).toBeInTheDocument();
    expect(screen.getByText('Contenido de la página')).toBeInTheDocument();
    expect(
      screen.queryByText(/Temporalmente fuera de servicio en modo offline/i)
    ).not.toBeInTheDocument();
  });

  it('muestra el mensaje de fuera de servicio cuando está offline', () => {
    vi.spyOn(onlineHook, 'useOnlineStatus').mockReturnValue(false);

    render(
      <OfflinePageGuard pageTitle="Auditoría">
        <div data-testid="contenido-protegido">Contenido de la página</div>
      </OfflinePageGuard>
    );

    expect(screen.queryByTestId('contenido-protegido')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Temporalmente fuera de servicio en modo offline/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Auditoría/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir a Reservas/i })).toHaveAttribute(
      'href',
      '/reservas'
    );
    expect(screen.getByRole('link', { name: /Volver al Inicio/i })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
