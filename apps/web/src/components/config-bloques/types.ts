export interface Horario {
  horaInicio: string;
  horaFin: string;
}

export interface ConfiguracionBloque {
  id: number;
  nombre: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaExacta: string | null;
  bloqueado: boolean;
  horarios: Horario[];
  version?: number;
  archivada?: boolean;
  archivadaEn?: string | null;
}
