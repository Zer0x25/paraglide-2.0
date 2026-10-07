import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import { FirmaDeslindeForm, DESLINDE_TEXTO_FALLBACK } from '../FirmaDeslindeForm';

describe('FirmaDeslindeForm Component', () => {
  const mockPasajero = {
    rutDni: '12.345.678-9',
    peso: 72,
    contactoEmergencia: 'María López',
    telefonoEmergencia: '+56988776655',
  };

  it('debe renderizar el texto de la declaración jurada legal y los campos del pasajero', () => {
    render(
      <FirmaDeslindeForm
        pasajero={mockPasajero}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    // Texto legal
    expect(screen.getByText('Términos y Declaración Jurada')).toBeInTheDocument();
    expect(screen.getByText(DESLINDE_TEXTO_FALLBACK)).toBeInTheDocument();

    // Campos del formulario hidratados
    expect(screen.getByDisplayValue('12.345.678-9')).toBeInTheDocument();
    expect(screen.getByDisplayValue('72')).toBeInTheDocument();
    expect(screen.getByDisplayValue('María López')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+56988776655')).toBeInTheDocument();

    // Canvas y watermark
    expect(screen.getByText('Firma Digital (Táctil o Ratón)')).toBeInTheDocument();
    expect(screen.getByText('Firme aquí dentro del recuadro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Limpiar Canvas/i })).toBeInTheDocument();
  });

  it('debe mantener deshabilitado el botón de confirmar si no hay trazo de firma', () => {
    render(
      <FirmaDeslindeForm
        pasajero={mockPasajero}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Confirmar y Firmar/i });
    expect(submitBtn).toBeDisabled();
  });

  it('debe llamar a onCancel si se proporciona la prop y se hace clic en Cancelar', () => {
    const onCancelMock = vi.fn();
    render(
      <FirmaDeslindeForm
        pasajero={mockPasajero}
        isSubmitting={false}
        onSubmit={vi.fn()}
        onCancel={onCancelMock}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelBtn);
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});
