import { render, renderHook, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ReactElement, ReactNode } from 'react';

// Pilar 5: todos los tests renderizan páginas que usan TanStack Query.
// Este client desactiva retries para que los errores no ensucien la salida.
export const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
      gcTime: Infinity,
    },
  },
});

export function renderWithQuery(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { ...options, wrapper: QueryWrapper });
}

function QueryWrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={testQueryClient}>
      {/* Toaster montado como en layout.tsx: los toasts de sonner solo
          renderizan DOM si existe <Toaster>; tests que afirman sobre su
          texto lo necesitan (ej. confirmación de archivado del modal). */}
      <Toaster position="top-right" richColors />
      {children}
    </QueryClientProvider>
  );
}

export { testQueryClient as queryClient };

export * from '@testing-library/react';
export { renderWithQuery as render, renderHook };
