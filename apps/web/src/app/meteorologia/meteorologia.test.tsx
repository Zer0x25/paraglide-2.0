import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import MeteorologiaPage from './page';
import * as useMeteorologiaHook from '../../hooks/useMeteorologia';
import type { CondicionPistaDTO } from '@parapente/shared';

vi.mock('../../hooks/useMeteorologia', () => ({
  useMeteorologia: vi.fn(),
}));

const mockEstadoActual = {
  id: 1,
  estadoPista: 'ABIERTA',
  velocidadViento: 14,
  rachaViento: 18,
  direccionViento: 'SO',
  temperatura: 21,
  visibilidad: 'EXCELENTE',
  techoNubes: 1800,
  observaciones: 'Condiciones térmicas óptimas en Maitencillo.',
  registradoPor: 'Director de Vuelo',
  createdAt: '2026-08-15T12:00:00.000Z',
};

describe('Página de Meteorología (/meteorologia) - Pruebas Unitarias y de Componente', () => {
  const mockRegistrarCondicion = vi.fn();
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMeteorologiaHook.useMeteorologia).mockReturnValue({
      estadoActual: mockEstadoActual as unknown as CondicionPistaDTO,
      historial: [mockEstadoActual] as unknown as CondicionPistaDTO[],
      loading: false,
      refetch: mockRefetch,
      registrarCondicion: mockRegistrarCondicion,
    } as unknown as ReturnType<typeof useMeteorologiaHook.useMeteorologia>);
  });

  it('1. Debe renderizar el estado actual de la pista y los instrumentos meteorológicos', () => {
    render(<MeteorologiaPage />);

    expect(screen.getByText('Estación Meteorológica & Estado de Pista')).toBeInTheDocument();
    expect(screen.getByText('14.0')).toBeInTheDocument(); // Velocidad viento
    expect(screen.getAllByText('SO')[0]).toBeInTheDocument(); // Dirección viento
    expect(screen.getByText('21.0')).toBeInTheDocument(); // Temperatura
  });

  it('2. Debe permitir seleccionar el estado de pista en el formulario y enviar registro', async () => {
    render(<MeteorologiaPage />);

    const submitBtn = screen.getByRole('button', { name: /Publicar Boletín Meteorológico/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRegistrarCondicion).toHaveBeenCalled();
    });
  });
});
