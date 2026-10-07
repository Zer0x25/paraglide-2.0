import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import ConfiguracionPage from './page';
import typedApi from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { TarifaDTO } from '@parapente/shared';

// Mock factory de typedApi (el módulo real crea una instancia axios con
// interceptors a nivel import: automock sin factory rompería la evaluación).
vi.mock('../../services/api', () => {
  const fn = () => vi.fn();
  const mockApi = {
    vuelos: { listar: fn(), crear: fn(), actualizar: fn(), eliminar: fn(), actualizarEstado: fn(), agendarGrupo: fn(), asignacionAutomatica: fn() },
    reservas: { listar: fn(), obtener: fn(), crear: fn(), actualizar: fn(), eliminar: fn(), agregarPago: fn(), eliminarPago: fn(), cancelar: fn() },
    pilotos: { listar: fn(), crear: fn(), actualizar: fn(), eliminar: fn(), obtenerDisponibilidad: fn(), guardarDisponibilidad: fn(), resetDisponibilidad: fn(), sugerir: fn() },
    equipos: { listar: fn(), obtener: fn(), crear: fn(), actualizar: fn(), eliminar: fn(), agregarMantenimiento: fn(), eliminarMantenimiento: fn() },
    gastos: { listar: fn(), crear: fn(), eliminar: fn() },
    meteorologia: { obtenerActual: fn(), obtenerHistorial: fn(), registrar: fn() },
    configuracion: { listar: fn(), crear: fn(), actualizar: fn(), eliminar: fn() },
    pasajeros: { listar: fn() },
    plantillas: { listar: fn(), crear: fn(), actualizar: fn(), eliminar: fn(), renderizar: fn() },
    auditoria: { listar: fn() },
    tarifas: { listar: fn(), crear: fn(), actualizar: fn(), eliminar: fn() },
    promociones: { listar: fn(), crear: fn(), actualizar: fn(), eliminar: fn() },
    faqs: { listar: fn(), crear: fn(), actualizar: fn(), eliminar: fn() },
    deslindes: { listar: fn(), crear: fn(), actualizar: fn(), eliminar: fn(), activar: fn() },
    reglasOperativas: { listar: fn(), upsert: fn(), eliminar: fn() },
    public: { deslindeActivo: fn(), faqsPublicas: fn() },
  };
  return { __esModule: true, default: mockApi, apiRaw: {} };
});

const mockTarifas = [
  { id: 1, nombre: 'Vuelo Tándem Standard', descripcion: 'Vuelo clásico 15 min', precio: 80000, activo: true },
  { id: 2, nombre: 'Vuelo Premium Foto', descripcion: null, precio: 120000, activo: false },
];

const mockPromociones = {
  data: [],
  pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0, hasMore: false, nextPage: null, nextCursor: null },
};

describe('Página de Configuración (/configuracion)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Admin por defecto (guard admin client-side).
    useAuthStore.setState({ user: { id: 1, email: 'admin@parapente.com', nombre: 'Admin', role: 'ADMIN' }, token: 'fake-token' });

    vi.mocked(typedApi.tarifas.listar).mockResolvedValue({
      data: mockTarifas as unknown as TarifaDTO[],
      pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1, hasMore: false, nextPage: null, nextCursor: null },
    });
    vi.mocked(typedApi.promociones.listar).mockResolvedValue(mockPromociones);
    vi.mocked(typedApi.deslindes.listar).mockResolvedValue([]);
    vi.mocked(typedApi.faqs.listar).mockResolvedValue(mockPromociones);
    vi.mocked(typedApi.reglasOperativas.listar).mockResolvedValue([]);
  });

  it('1. Renderiza el header y las cinco pestañas', () => {
    render(<ConfiguracionPage />);

    expect(screen.getByText('Configuración del Sistema')).toBeInTheDocument();
    for (const label of ['Tarifas', 'Promociones', 'Deslinde', 'FAQ', 'Reglas']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('2. Muestra las tarifas mockeadas en la pestaña inicial', async () => {
    render(<ConfiguracionPage />);

    await waitFor(() => {
      expect(screen.getByText('Vuelo Tándem Standard')).toBeInTheDocument();
    });
    expect(screen.getByText('Vuelo Premium Foto')).toBeInTheDocument();
    expect(screen.getByText('$80.000')).toBeInTheDocument(); // formatCLP es-CL
  });

  it('3. Cambia entre pestañas y muestra contenido propio de cada una', async () => {
    render(<ConfiguracionPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Deslinde' }));
    expect(await screen.findByText('Sin versiones de deslinde')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'FAQ' }));
    expect(await screen.findByText('Sin preguntas frecuentes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reglas' }));
    expect(await screen.findByText('Agendamiento')).toBeInTheDocument();

    // Volver a Tarifas sigue mostrando los datos (cache de TanStack Query)
    fireEvent.click(screen.getByRole('button', { name: 'Tarifas' }));
    expect(await screen.findByText('Vuelo Tándem Standard')).toBeInTheDocument();
  });

  it('4. Bloquea el acceso a usuarios no admin', () => {
    useAuthStore.setState({ user: { id: 2, email: 'p@p.com', nombre: 'Piloto', role: 'PILOTO' }, token: 't' });

    render(<ConfiguracionPage />);

    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    expect(screen.queryByText('Configuración del Sistema')).not.toBeInTheDocument();
  });

  it('5. Permite acceso a admin (regresión del guard)', async () => {
    useAuthStore.setState({ user: { id: 1, email: 'a@a.com', nombre: 'A', role: 'ADMIN' }, token: 't' });

    render(<ConfiguracionPage />);
    expect(screen.getByText('Configuración del Sistema')).toBeInTheDocument();

    await waitFor(() => {
      expect(typedApi.tarifas.listar).toHaveBeenCalled();
    });
  });
});
