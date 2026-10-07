import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui';
import { FirmaDeclaracionJurada } from './deslinde/FirmaDeclaracionJurada';
import { FirmaCamposPasajero } from './deslinde/FirmaCamposPasajero';
import { FirmaCanvasField } from './deslinde/FirmaCanvasField';

/**
 * Texto legal por defecto. Fuente compartida para seed del backend y
 * fallback client-side cuando no hay versión activa configurada.
 */
export const DESLINDE_TEXTO_FALLBACK =
  'Declaro estar en condiciones de salud física y mental óptimas para realizar la actividad de vuelo en parapente en modalidad tándem. ' +
  'Entiendo los riesgos inherentes a los deportes aéreos de aventura y acepto seguir estrictamente todas las instrucciones de seguridad impartidas por el piloto asignado.';

export interface FirmaData {
  rutDni: string | null;
  contactoEmergencia: string | null;
  telefonoEmergencia: string | null;
  condicionFisica: string | null;
  pesoVerificado: number | null;
  firmaBase64: string;
}

export interface FirmaDeslindeFormProps {
  pasajero: {
    rutDni?: string | null;
    contactoEmergencia?: string | null;
    telefonoEmergencia?: string | null;
    condicionFisica?: string | null;
    pesoVerificado?: number | null;
    peso?: number | null;
  };
  isSubmitting: boolean;
  onSubmit: (data: FirmaData) => void;
  onCancel?: () => void;
}

export function FirmaDeslindeForm({ pasajero, isSubmitting, onSubmit, onCancel }: FirmaDeslindeFormProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Texto legal configurable: versión activa desde /configuracion (público).
  const { data: deslindeActivo } = useQuery({
    queryKey: ['deslinde-activo'],
    queryFn: async () => {
      try {
        const { default: typedApi } = await import('@/services/api');
        return await typedApi.public.deslindeActivo();
      } catch {
        return null; // fallback silencioso
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const textoLegal = deslindeActivo?.texto?.trim() ? deslindeActivo.texto : DESLINDE_TEXTO_FALLBACK;

  // Campos adicionales de deslinde
  const [rutDni, setRutDni] = useState('');
  const [contactoEmergencia, setContactoEmergencia] = useState('');
  const [telefonoEmergencia, setTelefonoEmergencia] = useState('');
  const [condicionFisica, setCondicionFisica] = useState('Buena');
  const [pesoVerificado, setPesoVerificado] = useState<number | ''>('');

  /* eslint-disable react-hooks/set-state-in-effect -- hidrata formulario al cambiar pasajero; sincroniza estado controlado con prop */
  useEffect(() => {
    if (pasajero) {
      setRutDni(pasajero.rutDni || '');
      setContactoEmergencia(pasajero.contactoEmergencia || '');
      setTelefonoEmergencia(pasajero.telefonoEmergencia || '');
      setCondicionFisica(pasajero.condicionFisica || 'Buena');
      setPesoVerificado(pasajero.pesoVerificado || pasajero.peso || '');
      setHasSignature(false);
    }
  }, [pasajero]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) {
      toast.error('Por favor, dibuja tu firma antes de guardar');
      return;
    }

    const firmaBase64 = canvas.toDataURL('image/png');

    onSubmit({
      firmaBase64,
      rutDni: rutDni || null,
      contactoEmergencia: contactoEmergencia || null,
      telefonoEmergencia: telefonoEmergencia || null,
      condicionFisica: condicionFisica || null,
      pesoVerificado: pesoVerificado ? Number(pesoVerificado) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Texto Legal y Declaración */}
      <FirmaDeclaracionJurada textoLegal={textoLegal} />

      {/* 2. Campos de Pasajero y Contactos de Emergencia */}
      <FirmaCamposPasajero
        rutDni={rutDni}
        setRutDni={setRutDni}
        pesoVerificado={pesoVerificado}
        setPesoVerificado={setPesoVerificado}
        contactoEmergencia={contactoEmergencia}
        setContactoEmergencia={setContactoEmergencia}
        telefonoEmergencia={telefonoEmergencia}
        setTelefonoEmergencia={setTelefonoEmergencia}
      />

      {/* 3. Canvas de Firma Digital */}
      <FirmaCanvasField
        canvasRef={canvasRef}
        hasSignature={hasSignature}
        setHasSignature={setHasSignature}
        resetSignal={pasajero}
      />

      {/* 4. Botones de Acción */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>
        )}
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!hasSignature}
          className="px-6 py-2.5 text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20"
        >
          {isSubmitting ? (
            <span>Guardando...</span>
          ) : (
            <>
              <Check size={18} />
              <span>Confirmar y Firmar</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
