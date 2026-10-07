import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import PlantillasPage from './page';
import * as usePlantillasHook from '../../hooks/usePlantillas';
import type { PlantillaMensajeDTO } from '@parapente/shared';

vi.mock('../../hooks/usePlantillas', () => ({
  usePlantillas: vi.fn(),
}));

const mockPlantillasList = [
  {
    id: 1,
    tipo: 'CONFIRMACION_RESERVA',
    titulo: 'Confirmación y Bienvenida WhatsApp',
    canal: 'WHATSAPP',
    cuerpo: 'Hola {nombre}, tu reserva #{numero_reserva} está confirmada para el {fecha} a las {hora} hrs.',
    activo: true,
  },
  {
    id: 2,
    tipo: 'RECORDATORIO_24H',
    titulo: 'Recordatorio 24 Horas Antes',
    canal: 'WHATSAPP',
    cuerpo: 'Hola {nombre}, mañana es tu gran día de vuelo. Link de deslinde: {link_deslinde}',
    activo: true,
  }
];

describe('Página de Plantillas (/plantillas) - Pruebas Unitarias y de Componente', () => {
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockRender = vi.fn().mockImplementation((cuerpo: string) =>
    cuerpo.replace('{nombre}', 'Camila Morales').replace('{numero_reserva}', 'RES-8921')
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePlantillasHook.usePlantillas).mockReturnValue({
      plantillas: mockPlantillasList as unknown as PlantillaMensajeDTO[],
      loading: false,
      refetch: vi.fn(),
      createPlantilla: mockCreate,
      updatePlantilla: mockUpdate,
      deletePlantilla: mockDelete,
      renderTemplate: mockRender,
    } as unknown as ReturnType<typeof usePlantillasHook.usePlantillas>);
  });

  it('1. Debe renderizar las plantillas de mensaje y canales configurados', () => {
    render(<PlantillasPage />);

    expect(screen.getByText('Plantillas de Mensajes & WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Confirmación y Bienvenida WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Recordatorio 24 Horas Antes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nueva Plantilla/i })).toBeInTheDocument();
  });

  it('2. Debe abrir el modal para crear una nueva plantilla', () => {
    render(<PlantillasPage />);

    const nuevaBtn = screen.getByRole('button', { name: /Nueva Plantilla/i });
    fireEvent.click(nuevaBtn);

    expect(screen.getByText('Personaliza mensajes automatizados para WhatsApp / Correo')).toBeInTheDocument();
  });
});
