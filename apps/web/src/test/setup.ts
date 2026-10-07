import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Polyfill de localStorage: con Node 22/26 + jsdom, el getter nativo de Node
// emite ExperimentalWarning ("localStorage is not available because --localstorage-file was not provided").
// Sobrescribimos incondicionalmente con un stub en memoria para tests que lo usan (login, pantalla, authStore).
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(String(k), String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true, writable: true });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageStub, configurable: true, writable: true });
}

// Habilitar todos los módulos premium en el entorno de test.
// El estado de módulos ya no se lee de process.env (build-time) sino del runtime
// en apps/web/src/modules/runtime.ts, así que setteamos el Set directamente.
import { applyModulesChange, ALL_MODULE_IDS } from '../modules/runtime';
applyModulesChange([...ALL_MODULE_IDS]);

// (compat: las siguientes líneas ya no afectan, se dejan por si acaso)
const moduleIds = ['EQUIPOS', 'REPORTES', 'METEOROLOGIA', 'PANTALLA', 'PLANTILLAS'];
for (const id of moduleIds) {
  process.env[`NEXT_PUBLIC_ENABLE_MODULE_${id}`] = 'true';
}

// Mock window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock ResizeObserver (clase constructible: @tanstack/react-virtual hace `new`).
// Reporta un rect inicial para que los virtualizadores rendericen items en jsdom.
class ResizeObserverMock {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(el: Element) {
    this.cb(
      [{ target: el, borderBoxSize: [{ blockSize: 800, inlineSize: 800 }] } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  }
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock IntersectionObserver (clase constructible: scroll infinito on-demand).
class IntersectionObserverMock {
  private cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

// Mock scrollIntoView
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}

// Mock HTMLCanvasElement (jsdom no incluye canvas sin el paquete nativo)
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: [] })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({})),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  }) as never;
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');
}

// En jsdom los fetch fallan con Network Error (no hay servidor) y el interceptor de
// axios + los catch de componentes loguean console.error de forma asíncrona. En CI
// (runner lento) esto dispara el teardown race de Vitest:
//   EnvironmentTeardownError: 'Closing rpc while "onUserConsoleLog" was pending'
// Redirigimos console.error a stderr síncrono (sin pasar por el RPC de Vitest) para
// eliminar la carrera conservando la visibilidad de los errores en los logs.
vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  process.stderr.write(args.map(String).join(' ') + '\n');
});
