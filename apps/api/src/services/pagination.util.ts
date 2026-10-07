import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@parapente/shared';

export interface ListQuery {
  page?: string;
  pageSize?: string;
  cursor?: string;
  [key: string]: string | undefined;
}

export interface ParsedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  cursor?: string;
}

export function parsePagination(query: ListQuery): ParsedPagination {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(query.pageSize) || PAGE_SIZE_DEFAULT));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, cursor: query.cursor };
}

/**
 * Contrato de listados (ADR 005): envelope { data, pagination }.
 * Fuerza take (nunca findMany sin límite) y totalPages/hasMore.
 */
export async function listar<T>(
  query: ListQuery,
  load: (pagination: ParsedPagination) => Promise<T[]>,
  count: () => Promise<number>,
) {
  const pagination = parsePagination(query);
  const [data, total] = await Promise.all([load(pagination), count()]);
  const totalPages = Math.ceil(total / pagination.pageSize);
  const lastItem = data.length > 0 ? (data[data.length - 1] as any) : null;
  const lastId = lastItem?.id != null ? String(lastItem.id) : null;
  const hasMore = pagination.cursor
    ? data.length === pagination.pageSize && lastId !== null
    : pagination.page < totalPages;

  return {
    data,
    pagination: {
      page: pagination.cursor ? 1 : pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
      hasMore,
      nextPage: !pagination.cursor && hasMore ? pagination.page + 1 : null,
      ...(pagination.cursor ? { nextCursor: hasMore ? lastId : null } : {}),
    },
  };
}

/**
 * Parser de sort "campo.desc|asc" restringido a una whitelist por recurso.
 */
export function parseSort<T extends string>(
  sort: string | undefined,
  whitelist: readonly T[],
  fallback: { [K in T]?: 'asc' | 'desc' },
): { [K in T]?: 'asc' | 'desc' } {
  if (!sort) return { ...fallback };
  const [campo, direccion] = sort.split('.');
  if (!whitelist.includes(campo as T)) return { ...fallback };
  return { [campo]: direccion === 'desc' ? 'desc' : 'asc' } as { [K in T]?: 'asc' | 'desc' };
}