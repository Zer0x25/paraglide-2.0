"use client";

interface VoucherHeaderProps {
  numeroReserva?: string | null;
  reservaId: number | string;
  estado?: string | null;
}

export function VoucherHeader({ numeroReserva, reservaId, estado }: VoucherHeaderProps) {
  return (
    <div className="bg-linear-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-6 sm:p-8 relative overflow-hidden print:bg-none print:text-black print:border-b-2 print:border-black">
      <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black tracking-widest uppercase bg-white/20 px-2.5 py-1 rounded-full text-white print:text-black print:border print:border-black">
              TICKET OFICIAL DE VUELO
            </span>
            <span className="text-xs text-blue-100 font-extrabold print:text-black">
              #{numeroReserva || reservaId}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2 print:text-black">
            VUELO EN PARAPENTE
          </h1>
          <p className="text-xs text-blue-100 font-semibold mt-0.5 print:text-black">
            Experiencia Biplaza Tandem con Piloto Certificado
          </p>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block print:text-black">
            Estado del Ticket
          </span>
          {(() => {
            if (estado === 'CANCELADA') {
              return (
                <span className="inline-block mt-1 font-black text-sm px-3 py-1 bg-red-500 text-white rounded-xl shadow-xs print:text-black print:border print:border-black">
                  ✗ CANCELADA
                </span>
              );
            }
            if (estado === 'COMPLETADA') {
              return (
                <span className="inline-block mt-1 font-black text-sm px-3 py-1 bg-slate-800 text-white rounded-xl shadow-xs print:text-black print:border print:border-black">
                  ✓ COMPLETADA
                </span>
              );
            }
            if (estado === 'SIN_AGENDAR') {
              return (
                <span className="inline-block mt-1 font-black text-sm px-3 py-1 bg-amber-500 text-white rounded-xl shadow-xs print:text-black print:border print:border-black">
                  ○ SIN AGENDAR
                </span>
              );
            }
            return (
              <span className="inline-block mt-1 font-black text-sm px-3 py-1 bg-emerald-500 text-white rounded-xl shadow-xs print:text-black print:border print:border-black">
                ✓ CONFIRMADO
              </span>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
