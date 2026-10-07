import { describe, it, expect } from 'vitest';
import {
  HEADER_X_OUTBOX,
  HEADER_X_OUTBOX_VALUE,
  withOutboxHeaders,
} from './apiWithOutbox';

describe('apiWithOutbox (ADR 009)', () => {
  it('withOutboxHeaders() devuelve el header X-Outbox con valor "1"', () => {
    const headers = withOutboxHeaders();
    expect(headers).toEqual({ [HEADER_X_OUTBOX]: HEADER_X_OUTBOX_VALUE });
    expect(headers['X-Outbox']).toBe('1');
  });

  it('withOutboxHeaders(extra) fusiona headers extra con prioridad sobre X-Outbox si colisionan', () => {
    const headers = withOutboxHeaders({
      'X-Trace-Id': 'abc-123',
      'X-Outbox': '0', // colisión: el extra gana
    });
    expect(headers['X-Trace-Id']).toBe('abc-123');
    expect(headers['X-Outbox']).toBe('0');
  });
});
