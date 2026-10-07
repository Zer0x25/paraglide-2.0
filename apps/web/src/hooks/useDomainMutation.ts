import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Primitiva unificada de mutaciones de dominio (Pilar 6, ADR 009).
 *
 * Envuelve `useMutation` de TanStack Query y centraliza:
 * - Detección de 409 Conflict → invalidación + toast + callback `onConflict`.
 * - Toast automático de éxito/error con mensajes configurables.
 * - Invalidación declarativa de queryKeys on success.
 *
 * Reemplaza todo el código ad-hoc de `if (error?.response?.status === 409)` y
 * los `try/catch + toast + invalidateQueries` manuales en los hooks de dominio.
 */

export function isConflictError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { response?: { status?: number } }).response?.status === 409
  );
}

/**
 * Detecta si el error corresponde a una mutación encolada exitosamente en el
 * outbox de IndexedDB para sincronización offline (ADR 009).
 */
export function isQueuedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    Boolean((error as { queued?: boolean }).queued)
  );
}

/**
 * Configuración de actualización optimista (ADR 004, ADR 009).
 *
 * Cuando se proporciona, el dato de `queryKey` se actualiza inmediatamente
 * al iniciar la mutación (antes de que responda el servidor) y se restaura
 * el snapshot si la mutación falla (incluido 409 Conflict).
 */
export interface OptimisticUpdateConfig<TVariables = void> {
  /** QueryKey cuyo dato se actualiza optimistamente. */
  queryKey: QueryKey;
  /** Deriva el nuevo valor desde el anterior y las variables. */
  updater: (previous: unknown, variables: TVariables) => unknown;
}

/** Clave privada bajo la que se guarda el snapshot pre-optimista en el contexto. */
const CLAVE_SNAPSHOT_OPTIMISTA = '__optimisticPrev';

/** Forma interna del contexto cuando hay optimistic update activo. */
interface ContextoConSnapshot {
  [CLAVE_SNAPSHOT_OPTIMISTA]?: unknown;
}

export interface UseDomainMutationOptions<
  TData = unknown,
  TVariables = void,
  TContext = unknown,
> extends Omit<UseMutationOptions<TData, unknown, TVariables, TContext>, 'onError' | 'onSuccess'> {
  /** QueryKeys a invalidar tras mutación exitosa o conflicto 409. */
  invalidateKeys: QueryKey[];

  /** Mensaje de toast al completar exitosamente (null = sin toast). */
  successMessage?: string | null;

  /** Mensaje de toast al fallar (null = sin toast, usa mensaje del error). */
  errorMessage?: string | null;

  /** Callback para mostrar UI de conflicto (post-toast, post-invalidación). */
  onConflict?: (error: unknown, variables: TVariables) => void;

  /** onSuccess passthrough (se ejecuta DESPUÉS del toast e invalidación). */
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;

  /** onError passthrough para errores no-409. */
  onError?: (error: unknown, variables: TVariables, context: TContext | undefined) => void;

  /**
   * Actualización optimista opcional (ADR 004, ADR 009): aplica `updater`
   * sobre `queryKey` en `onMutate`, cancela las queries en vuelo y restaura
   * el snapshot en cualquier error (409 y no-409) antes de invalidar/toast.
   * Si el usuario pasa `onMutate`, se ejecuta DESPUÉS del optimistic update
   * y ambos contextos se fusionan.
   */
  optimisticUpdate?: OptimisticUpdateConfig<TVariables>;

  /**
   * Si es `true`, declara que la mutación debe encolarse en el outbox
   * cuando la red falle (ADR 009). El flag es por ahora declarativo:
   * el `mutationFn` debe pasar explícitamente los headers devueltos por
   * `withOutboxHeaders()` de `services/apiWithOutbox` a la llamada axios.
   *
   *   useDomainMutation({
   *     invalidateKeys: [['reservas']],
   *     outbox: true,
   *     mutationFn: (payload) =>
   *       typedApi.reservas.crear(payload, { headers: withOutboxHeaders() }),
   *   });
   *
   * Default: false. Solo aplicar a mutaciones idempotentes o duplicables
   * (el outbox reconcilia 409 en conflictos; no usar para login/búsquedas).
   */
  outbox?: boolean;
}

export function useDomainMutation<
  TData = unknown,
  TVariables = void,
  TContext = unknown,
>({
  invalidateKeys,
  successMessage,
  errorMessage,
  onConflict,
  onSuccess,
  onError,
  mutationFn,
  optimisticUpdate,
  outbox: _outbox, // eslint-disable-line @typescript-eslint/no-unused-vars -- declarativo por ahora: el call site debe usar withOutboxHeaders()
  ...rest
}: UseDomainMutationOptions<TData, TVariables, TContext>) {
  const queryClient = useQueryClient();

  // `onMutate` del usuario vive en `rest`: lo extraemos para encadenarlo
  // después del optimistic update sin romper su contrato.
  const { onMutate: onMutateUsuario } = rest as UseMutationOptions<
    TData,
    unknown,
    TVariables,
    TContext
  >;

  const onMutateEncadenado = async (
    variables: TVariables,
  ): Promise<TContext> => {
    let snapshot: unknown;
    if (optimisticUpdate) {
      await queryClient.cancelQueries({ queryKey: optimisticUpdate.queryKey });
      const previo = queryClient.getQueryData(optimisticUpdate.queryKey);
      queryClient.setQueryData(
        optimisticUpdate.queryKey,
        optimisticUpdate.updater(previo, variables) as unknown,
      );
      snapshot = previo;
    }
    const ctxUsuario = await onMutateUsuario?.(variables, queryClient as never);
    if (!optimisticUpdate) {
      return ctxUsuario as TContext;
    }
    // Fusionamos el contexto del usuario con el snapshot privado.
    // Cast seguro: TContext es opaco para esta primitiva.
    return {
      ...((ctxUsuario ?? {}) as object),
      [CLAVE_SNAPSHOT_OPTIMISTA]: snapshot,
    } as TContext;
  };

  const restaurarSnapshotSiAplica = (context: TContext | undefined) => {
    if (
      optimisticUpdate &&
      context !== null &&
      typeof context === 'object' &&
      CLAVE_SNAPSHOT_OPTIMISTA in context
    ) {
      queryClient.setQueryData(
        optimisticUpdate.queryKey,
        (context as ContextoConSnapshot)[CLAVE_SNAPSHOT_OPTIMISTA],
      );
    }
  };

  return useMutation<TData, unknown, TVariables, TContext>({
    ...rest,
    mutationFn,
    onMutate: onMutateEncadenado,
    onSuccess: (data, variables, context) => {
      // Invalidate related queries
      invalidateKeys.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      // Show success toast
      if (successMessage !== null && successMessage !== undefined) {
        toast.success(successMessage);
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      // ADR 009: si la mutación fue encolada en el outbox de IndexedDB,
      // la acción se ejecutará automáticamente al reconectar.
      // NO debe alertar como error fallido en la UI.
      if (isQueuedError(error)) {
        onError?.(error, variables, context);
        return;
      }

      // Rollback optimista ANTES de invalidar/toast/callbacks (ADR 004):
      // aplica tanto a 409 como a errores no-409.
      restaurarSnapshotSiAplica(context);
      if (isConflictError(error)) {
        // 409 Conflict — invalidate + toast + callback
        invalidateKeys.forEach((key) =>
          queryClient.invalidateQueries({ queryKey: key }),
        );
        toast.error('Los datos cambiaron en otro dispositivo. Recargando...');
        onConflict?.(error, variables);
        return;
      }
      // Non-409 error
      const msg =
        errorMessage ??
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (error as Error)?.message ??
        'Ha ocurrido un error';
      if (msg !== null) {
        toast.error(msg);
      }
      onError?.(error, variables, context);
    },
  });
}
