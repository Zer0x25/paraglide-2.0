'use client';

import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

type Listener = () => void;
const listeners = new Set<Listener>();

let isOnlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignorar fallos de un suscriptor individual
    }
  });
}

/**
 * Actualiza el estado de conectividad global.
 * Sincroniza tanto los componentes React suscritos como el onlineManager de TanStack Query.
 */
export function setOnlineStatus(online: boolean) {
  if (isOnlineState !== online) {
    isOnlineState = online;
    if (typeof window !== 'undefined') {
      try {
        onlineManager.setOnline(online);
      } catch {
        // Fallback si TanStack Query no está disponible
      }
    }
    notify();
  }
}

/**
 * Reporta un fallo de conexión a nivel de red (API / fetch / axios).
 * Pone la aplicación en modo offline de inmediato sin depender exclusivamente
 * de los eventos a veces demorados o imprecisos del sistema operativo.
 */
export function reportNetworkError() {
  setOnlineStatus(false);
}

/**
 * Reporta una respuesta exitosa de la API o reconexión confirmada.
 * Restaura el estado online globalmente.
 */
export function reportNetworkSuccess() {
  setOnlineStatus(true);
}

// Escuchar eventos estándar del navegador (window 'online' y 'offline')
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setOnlineStatus(true));
  window.addEventListener('offline', () => setOnlineStatus(false));
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return isOnlineState;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * Hook global de estado de conexión (ADR 009).
 * Reactivo a nivel de app con useSyncExternalStore, sincronizado con TanStack Query
 * y alimentado por eventos del navegador y telemetría activa de la API.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

