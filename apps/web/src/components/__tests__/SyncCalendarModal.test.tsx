import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import { SyncCalendarModal } from '../SyncCalendarModal';
import { apiRaw as api } from '../../services/api';
import * as clipboard from '../../utils/clipboard';

vi.mock('../../services/api', () => ({
  apiRaw: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../utils/clipboard', () => ({
  copyTextToClipboard: vi.fn(),
}));

const mockSyncData = {
  universal: {
    token: 'tok_universal_123',
    httpUrl: '/api/public/calendar/feed.ics?token=tok_universal_123',
    webcalUrl: 'webcal://localhost:3001/api/public/calendar/feed.ics?token=tok_universal_123',
    googleCalendarUrl: '',
  },
  pilotos: [
    {
      id: 10,
      nombre: 'Carlos Piloto',
      categoria: 'Tándem Pro',
      token: 'tok_carlos_456',
      httpUrl: '/api/public/calendar/feed.ics?token=tok_carlos_456',
      webcalUrl: 'webcal://localhost:3001/api/public/calendar/feed.ics?token=tok_carlos_456',
    },
  ],
  googleCalendar: {
    enabled: true,
    calendarId: 'cal_official_789',
    oneClickSubscribeUrl: 'https://calendar.google.com/calendar/r?cid=cal_official_789',
  },
};

describe('SyncCalendarModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no debe renderizar nada si isOpen es false', () => {
    render(<SyncCalendarModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Sincronización de Calendario')).not.toBeInTheDocument();
  });

  it('debe renderizar el modal con los datos de sincronización y plataformas disponibles', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockSyncData } as unknown as Awaited<ReturnType<typeof api.get>>);

    render(<SyncCalendarModal isOpen={true} onClose={vi.fn()} />);

    // Esperar a que cargue la información
    await waitFor(() => {
      expect(screen.getByText('Sincronización de Calendario')).toBeInTheDocument();
      expect(screen.getByText('Todos los Vuelos (Admin)')).toBeInTheDocument();
      expect(screen.getByText('iPhone / iPad / Mac (Apple Calendar)')).toBeInTheDocument();
      expect(screen.getByText('Google Calendar (Gmail / Android)')).toBeInTheDocument();
      expect(screen.getByText('Descargar Archivo .ics (Universal)')).toBeInTheDocument();
    });

    // Validar presencia de botón de reconciliación cuando Google Calendar está activo
    expect(screen.getByText('Sincronización Total Desatendida')).toBeInTheDocument();
    expect(screen.getByText('Sincronizar Todo')).toBeInTheDocument();
  });

  it('debe permitir cambiar de destino a un piloto específico', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockSyncData } as unknown as Awaited<ReturnType<typeof api.get>>);

    render(<SyncCalendarModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Piloto (Tándem Pro)')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '10' } });

    expect(screen.getByText('Piloto: Carlos Piloto')).toBeInTheDocument();
  });

  it('debe copiar el enlace al hacer clic en Copiar', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockSyncData } as unknown as Awaited<ReturnType<typeof api.get>>);
    vi.mocked(clipboard.copyTextToClipboard).mockResolvedValueOnce(true);

    render(<SyncCalendarModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copiar/i })).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: /Copiar/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText('¡Copiado!')).toBeInTheDocument();
    });

    expect(clipboard.copyTextToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('token=tok_universal_123')
    );
  });

  it('debe mostrar la fecha de expiración del token de suscripción', async () => {
    const syncDataConExpiracion = {
      ...mockSyncData,
      universal: { ...mockSyncData.universal, expiraEn: '2027-09-29T12:00:00.000Z' },
    };
    vi.mocked(api.get).mockResolvedValueOnce({ data: syncDataConExpiracion } as unknown as Awaited<ReturnType<typeof api.get>>);

    render(<SyncCalendarModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Válido hasta/i)).toBeInTheDocument();
    });
  });

  it('debe regenerar el enlace solo tras confirmación explícita (2a)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockSyncData } as unknown as Awaited<ReturnType<typeof api.get>>);
    vi.mocked(api.post).mockResolvedValue({ success: true } as unknown as Awaited<ReturnType<typeof api.post>>);

    render(<SyncCalendarModal isOpen={true} onClose={vi.fn()} />);

    const regenBtn = await screen.findByRole('button', { name: /Regenerar enlace/i });
    fireEvent.click(regenBtn);

    // Paso de confirmación: advertir antes de invalidar los enlaces anteriores
    expect(await screen.findByText(/Los enlaces anteriores dejarán de funcionar/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Sí, regenerar/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/calendar/feed-token/regenerate', {
        scope: 'all',
        pilotoId: undefined,
      });
    });
    // Se refresca la información de sincronización con el token nuevo
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });
});
