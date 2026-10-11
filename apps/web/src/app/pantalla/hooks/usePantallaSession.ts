import { useSyncExternalStore, useCallback } from 'react';
import Cookies from 'js-cookie';

export const PANTALLA_TOKEN_KEY = 'pantalla_token';

let cachedToken: string | null = null;
let cachedAdminToken: string | null = null;
let isInitialized = false;

// Global listeners for cross-component sync if needed
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function resetPantallaSessionForTests() {
  isInitialized = false;
  cachedToken = null;
  cachedAdminToken = null;
}

function initTokens() {
  if (isInitialized || typeof window === 'undefined') return;

  const urlToken = new URLSearchParams(window.location.search).get('token');
  const storedToken = localStorage.getItem(PANTALLA_TOKEN_KEY);
  const tokenActual = urlToken || storedToken || null;

  if (urlToken) {
    localStorage.setItem(PANTALLA_TOKEN_KEY, urlToken);
  }

  cachedToken = tokenActual;
  cachedAdminToken = Cookies.get('token') ?? null;
  isInitialized = true;
}

function getClientSnapshot() {
  initTokens();
  // Return a stable JSON string to avoid unnecessary re-renders when returning a new object reference
  return JSON.stringify({ token: cachedToken, adminToken: cachedAdminToken });
}

function getServerSnapshot() {
  return JSON.stringify({ token: null, adminToken: null });
}

function subscribe(callback: () => void) {
  listeners.add(callback);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === PANTALLA_TOKEN_KEY) {
      cachedToken = e.newValue;
      emitChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

export function usePantallaSession() {
  const snapshotStr = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const { token, adminToken } = JSON.parse(snapshotStr) as { token: string | null; adminToken: string | null };

  const clearToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PANTALLA_TOKEN_KEY);
    }
    cachedToken = null;
    emitChange();
  }, []);

  return { token, adminToken, clearToken };
}
