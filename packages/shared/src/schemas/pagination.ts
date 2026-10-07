import { z } from 'zod';

export const PAGE_SIZE_DEFAULT = 100;
export const PAGE_SIZE_MAX = 500;

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
  // Contrato v2 (Pilar 5): keyset pagination para listas temporales no
  // acotadas (auditoría). Valor = id de la última fila devuelta.
  cursor: z.string().optional(),
});
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export const PaginationInfoSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasMore: z.boolean(),
  // Contrato v2: nextPage para scroll infinito basado en offset
  // (useInfiniteQuery) y nextCursor para keyset
  nextPage: z.number().int().min(1).nullable().optional(),
  nextCursor: z.string().nullable().optional(),
});
export type PaginationInfo = z.infer<typeof PaginationInfoSchema>;

export function ListEnvelopeSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationInfoSchema,
  });
}
export type ListEnvelope<T> = {
  data: T[];
  pagination: PaginationInfo;
};

export const VueloListQuerySchema = PaginationParamsSchema.extend({
  desde: z.string().optional(),
  hasta: z.string().optional(),
  estado: z.string().optional(),
  sort: z.string().optional(),
  campos: z.enum(['vista-calendario']).optional(),
});

export const ReservaListQuerySchema = PaginationParamsSchema.extend({
  q: z.string().optional(),
  estado: z.string().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  sort: z.string().optional(),
});

export const PilotoListQuerySchema = PaginationParamsSchema.extend({
  q: z.string().optional(),
  activo: z.string().optional(),
  sort: z.string().optional(),
});

export const PasajeroListQuerySchema = PaginationParamsSchema.extend({
  q: z.string().optional(),
});

export const GastoListQuerySchema = PaginationParamsSchema.extend({
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

export const EquipoListQuerySchema = PaginationParamsSchema.extend({
  tipo: z.string().optional(),
  estado: z.string().optional(),
});

export const UserListQuerySchema = PaginationParamsSchema.extend({
  q: z.string().optional(),
  role: z.string().optional(),
  sort: z.string().optional(),
});

export const AuditoriaListQuerySchema = PaginationParamsSchema.extend({
  entidad: z.string().optional(),
  accion: z.string().optional(),
  busqueda: z.string().optional(),
});
