export interface GastoDTO {
  id: number;
  fecha: string | Date;
  categoria: string;
  monto: number;
  descripcion?: string | null;
  version?: number;
}
