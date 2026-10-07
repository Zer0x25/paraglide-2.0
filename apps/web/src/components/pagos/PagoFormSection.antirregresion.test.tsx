import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/render';
import { PagoFormSection } from './PagoFormSection';

const baseProps = {
  saldoPendiente: 50000,
  monto: '' as number | '',
  setMonto: () => {},
  metodoPago: 'TRANSFERENCIA' as const,
  setMetodoPago: () => {},
  comprobante: '',
  setComprobante: () => {},
  notas: '',
  setNotas: () => {},
  onAddPago: () => {},
  pagos: [],
  pendingPagos: [],
  deletingPagos: [],
  onToggleDeletePago: () => {},
  onRemovePendingPago: () => {},
};

describe('PagoFormSection — antirregresión (Ficha oculta en CANCELADA + saldo 0)', () => {
  it('oculta el formulario cuando esCancelada=true aunque haya saldo pendiente', () => {
    render(<PagoFormSection {...baseProps} saldoPendiente={50000} esCancelada />);
    expect(screen.queryByText(/Registrar Nuevo Abono/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin saldo pendiente/i)).not.toBeInTheDocument();
  });

  it('oculta el formulario cuando esCancelada=true y saldo 0 (no muestra card pagado)', () => {
    render(<PagoFormSection {...baseProps} saldoPendiente={0} esCancelada />);
    expect(screen.queryByText(/Registrar Nuevo Abono/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin saldo pendiente/i)).not.toBeInTheDocument();
  });

  it('muestra el formulario cuando NO es cancelada y hay saldo pendiente', () => {
    render(<PagoFormSection {...baseProps} saldoPendiente={50000} />);
    expect(screen.getByText(/Registrar Nuevo Abono/i)).toBeInTheDocument();
  });

  it('muestra card pagado cuando NO es cancelada y saldo 0', () => {
    render(<PagoFormSection {...baseProps} saldoPendiente={0} />);
    expect(screen.getByText(/Sin saldo pendiente/i)).toBeInTheDocument();
    expect(screen.queryByText(/Registrar Nuevo Abono/i)).not.toBeInTheDocument();
  });

  it('mantiene visible la lista de transacciones aun cuando esCancelada', () => {
    const pagos = [{ id: 1, monto: 10000, metodoPago: 'EFECTIVO' as const, fecha: new Date().toISOString() }];
    render(<PagoFormSection {...baseProps} saldoPendiente={0} esCancelada pagos={pagos} />);
    // La lista de transacciones debe seguir visible (historial)
    expect(screen.getByText(/Historial de Transacciones/i)).toBeInTheDocument();
  });
});
