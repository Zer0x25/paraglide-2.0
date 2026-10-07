/**
 * Tipos fundamentales para el framework de pruebas E2E de Staging y Producción
 */

import type { Browser, BrowserContext, Page } from '@playwright/test';

export interface SuiteConfig {
  name: string;
  description?: string;
  targetUrl?: string;
  adminEmail?: string;
  adminPassword?: string;
  headless?: boolean;
  timeoutMs?: number;
  waitForDeploy?: boolean;
  expectedCommit?: string | null;
}

export interface StepResult {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface SuiteResult {
  suiteName: string;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  durationMs: number;
  steps: StepResult[];
  ok: boolean;
}

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  token?: string;
  skipAuth?: boolean;
}

export interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  headers: Headers;
  rawText?: string;
}

export interface EnvelopeList<T> {
  data: T[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  consoleErrors: string[];
  pageErrors: Error[];
  close: () => Promise<void>;
}

export interface TeardownRegistry {
  registerPiloto: (id: number) => void;
  registerReserva: (id: number) => void;
  registerVuelo: (id: number) => void;
  registerPasajero: (id: number) => void;
  registerCustom: (cleanupFn: () => Promise<void>) => void;
  cleanup: () => Promise<void>;
}

export interface SSEMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface SSEListener {
  events: SSEMessage[];
  waitForEvent: (predicate: (ev: SSEMessage) => boolean, timeoutMs?: number) => Promise<SSEMessage>;
  close: () => void;
}

