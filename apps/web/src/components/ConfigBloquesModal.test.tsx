import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test/render';
import { ConfigBloquesModal, type ConfiguracionBloque } from './ConfigBloquesModal';
import api from '../services/api';

vi.mock('../services/api', () => {
  const mockApi = {

    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(),
    vuelos: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), actualizarEstado: vi.fn(), agendarGrupo: vi.fn(), asignacionAutomatica: vi.fn() },
    pilotos: { listar: vi.fn(), obtenerDisponibilidad: vi.fn(), guardarDisponibilidad: vi.fn(), resetDisponibilidad: vi.fn(), crear: vi.fn(), actualizar: vi.fn() },
    pasajeros: { listar: vi.fn() },
    reservas: { listar: vi.fn(), agregarPago: vi.fn(), eliminarPago: vi.fn() },
    configuracion: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), resolver: vi.fn(), limpiarExpiradas: vi.fn() },
    equipos: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), agregarMantenimiento: vi.fn(), eliminarMantenimiento: vi.fn() },
    plantillas: { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(), renderizar: vi.fn() },
    meteorologia: { listar: vi.fn(), obtenerActual: vi.fn(), obtenerHistorial: vi.fn(), registrar: vi.fn() },
    gastos: { listar: vi.fn(), crear: vi.fn(), eliminar: vi.fn() },
    auditoria: { listar: vi.fn() }

  };
  return {
    __esModule: true,
    default: mockApi,
    apiRaw: mockApi
  };
});

const mockConfigList: ConfiguracionBloque[] = [
  {
    id: 1,
    nombre: 'Horario Base Estándar',
    fechaInicio: null,
    fechaFin: null,
    fechaExacta: null,
    bloqueado: false,
    horarios: [
      { horaInicio: '10:00', horaFin: '11:00' },
      { horaInicio: '11:30', horaFin: '12:30' },
    ],
  },
  {
    id: 2,
    nombre: 'Feriado Bloqueado',
    fechaInicio: null,
    fechaFin: null,
    fechaExacta: '2026-09-18',
    bloqueado: true,
    horarios: [],
  }
];

describe('Modal de Configuración de Horarios (dentro de /calendario) - Pruebas Unitarias y de Componente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.configuracion.listar).mockResolvedValue(mockConfigList as unknown as never);
  });

  it('1. Debe renderizar la lista de reglas de bloques y horarios configurados', async () => {
    render(<ConfigBloquesModal isOpen onClose={() => {}} />);

    expect(screen.getByText('Configuración de Horarios')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Horario Base Estándar')).toBeInTheDocument();
      expect(screen.getByText('Feriado Bloqueado')).toBeInTheDocument();
      expect(screen.getByText('10:00 - 11:00')).toBeInTheDocument();
    });
  });

  it('2. Debe abrir el modal para crear una nueva regla de horario', async () => {
    render(<ConfigBloquesModal isOpen onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Horario Base Estándar')).toBeInTheDocument();
    });

    const nuevaReglaBtn = screen.getByRole('button', { name: /Nueva Regla/i });
    fireEvent.click(nuevaReglaBtn);

    expect(screen.getByText('Crear Regla de Horario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ej: Temporada Alta, Horario Base, Evento Especial\.\.\./i)).toBeInTheDocument();
  });

  it('3. No debe renderizar contenido cuando está cerrado', () => {
    const { container } = render(<ConfigBloquesModal isOpen={false} onClose={() => {}} />);
    // El wrapper de test monta el <Toaster> de sonner (fuera de container):
    // se ignora para verificar que el modal cerrado no renderiza nada.
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('4. Debe mostrar badge de numeración (#1, #2) junto a las reglas', async () => {
    render(<ConfigBloquesModal isOpen onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
  });

  it('5. Debe mostrar la sección colapsable de archivadas con nota de historial', async () => {
    vi.mocked(api.configuracion.listar).mockResolvedValue([
      ...mockConfigList,
      {
        id: 3,
        nombre: 'Temporada Invierno (expirada)',
        fechaInicio: '2026-06-01T03:00:00.000Z',
        fechaFin: '2026-07-31T03:00:00.000Z',
        fechaExacta: null,
        bloqueado: false,
        horarios: [{ horaInicio: '09:00', horaFin: '10:00' }],
        archivada: true,
        archivadaEn: '2026-08-01T12:00:00.000Z',
      },
    ] as unknown as never);

    render(<ConfigBloquesModal isOpen onClose={() => {}} />);

    const toggle = await screen.findByText(/Archivadas \/ Expiradas \(1\)/i);
    fireEvent.click(toggle);

    expect(screen.getByText('El historial del calendario se conserva.')).toBeInTheDocument();
    expect(screen.getByText('Temporada Invierno (expirada)')).toBeInTheDocument();
  });

  it('6. El archivado de expiradas es automático: no existe botón manual', async () => {
    render(<ConfigBloquesModal isOpen onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Horario Base Estándar')).toBeInTheDocument();
    });
    // La higiene ahora corre en la API (barrido al arrancar + diario 03:00 UTC):
    // el botón manual fue retirado de la UI.
    expect(screen.queryByRole('button', { name: /Limpiar expiradas/i })).toBeNull();
  });

  it('7. Eliminar muestra confirmación de archivado conservando historial', async () => {
    render(<ConfigBloquesModal isOpen onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Horario Base Estándar')).toBeInTheDocument();
    });

    // Botones de acción por tarjeta: el primero es editar, el segundo eliminar
    const deleteButtons = screen.getAllByRole('button').filter(b => b.querySelector('.lucide-trash2, svg.lucide-trash-2'));
    // Fallback robusto: buscar por ícono Trash2 dentro del contenedor de cada tarjeta
    const trashIcons = document.querySelectorAll('svg.lucide-trash2');
    const target = deleteButtons.length > 0 ? deleteButtons[0] : (trashIcons[0]?.closest('button') as HTMLButtonElement);
    expect(target).toBeTruthy();
    fireEvent.click(target);

    await waitFor(() => {
      expect(screen.getByText(/Se archivará\. El calendario histórico conservará su configuración\./i)).toBeInTheDocument();
    });
  });
});