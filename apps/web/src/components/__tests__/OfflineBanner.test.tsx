import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '../OfflineBanner';
import * as onlineHook from '@/hooks/useOnlineStatus';

describe('OfflineBanner (ADR 009)', () => {
  it('no renderiza nada cuando está online', () => {
    vi.spyOn(onlineHook, 'useOnlineStatus').mockReturnValue(true);

    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza el banner de aviso cuando está offline', () => {
    vi.spyOn(onlineHook, 'useOnlineStatus').mockReturnValue(false);

    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Modo sin conexión:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Operando con datos guardados localmente/i)
    ).toBeInTheDocument();
  });
});
