import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { OutboxBadge } from '@/components/OutboxBadge';

const mockEntries = [
  { id: 'e1', entidad: 'piloto', metodo: 'PUT' as const, url: '/api/pilotos/1', createdAt: 1, intentos: 0 },
  { id: 'e2', entidad: 'reserva', metodo: 'POST' as const, url: '/api/reservas', createdAt: 2, intentos: 0 },
];

const mockConflictos = [
  { id: 'c1', entidad: 'piloto', metodo: 'PUT' as const, url: '/api/pilotos/2', createdAt: 3, error: 'conflicto 409' },
];

vi.mock('@/services/outbox/outbox.service', () => ({
  subscribeOutboxCount: vi.fn((cb: (n: number) => void) => {
    cb(0);
    return () => {};
  }),
  listOutbox: vi.fn().mockResolvedValue([]),
  listConflictos: vi.fn().mockResolvedValue([]),
  replayOutbox: vi.fn().mockResolvedValue({ ok: 1, conflicts: 0, remaining: 0 }),
  // ADR 009: lock centralizado usado ahora por doReplay del badge
  replayIfIdle: vi.fn().mockResolvedValue({ ok: 1, conflicts: 0, remaining: 0 }),
  removeFromOutbox: vi.fn().mockResolvedValue(undefined),
  removeConflicto: vi.fn().mockResolvedValue(undefined),
  clearConflictos: vi.fn().mockResolvedValue(undefined),
  reintentarConflicto: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('@/services/api', () => ({
  apiRaw: {},
}));

import {
  subscribeOutboxCount,
  listOutbox,
  listConflictos,
  replayIfIdle,
  removeConflicto,
} from '@/services/outbox/outbox.service';

describe('OutboxBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (subscribeOutboxCount as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (n: number) => void) => {
        cb(0);
        return () => {};
      },
    );
    (listOutbox as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (listConflictos as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (replayIfIdle as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: 1,
      conflicts: 0,
      remaining: 0,
    });
  });

  it('no renderiza nada cuando count y conflictos son 0', async () => {
    render(<OutboxBadge />);
    await waitFor(() => {
      expect(listOutbox).toHaveBeenCalled();
      expect(listConflictos).toHaveBeenCalled();
    });
    expect(screen.queryByText(/pendiente/i)).toBeNull();
    expect(screen.queryByText(/conflicto/i)).toBeNull();
  });

  it('muestra "N cambios pendientes" y lista las entradas al abrir', async () => {
    (subscribeOutboxCount as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (n: number) => void) => {
        cb(2);
        return () => {};
      },
    );
    (listOutbox as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockEntries);

    render(<OutboxBadge />);

    expect(await screen.findByText('2 cambios pendientes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2 cambios pendientes/i }));

    expect(await screen.findByText('piloto')).toBeInTheDocument();
    expect(screen.getByText('reserva')).toBeInTheDocument();
    expect(screen.getByText('PUT /api/pilotos/1')).toBeInTheDocument();
    expect(screen.getByText('POST /api/reservas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reintentar ahora/i }));
    await waitFor(() => {
      // ADR 009: el botón manual pasa por el lock centralizado replayIfIdle.
      expect(replayIfIdle).toHaveBeenCalled();
      expect((listOutbox as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('muestra "N conflicto" y el mensaje de conflicto en el panel con opciones de resolución', async () => {
    (subscribeOutboxCount as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (n: number) => void) => {
        cb(0);
        return () => {};
      },
    );
    (listConflictos as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockConflictos);

    render(<OutboxBadge />);

    expect(await screen.findByText('1 conflicto')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /1 conflicto/i }));

    expect(await screen.findByText('conflicto 409')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Descartar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reintentar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descartar todos los conflictos/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Descartar$/i }));
    await waitFor(() => {
      expect(removeConflicto).toHaveBeenCalledWith('c1');
    });
  });
});
