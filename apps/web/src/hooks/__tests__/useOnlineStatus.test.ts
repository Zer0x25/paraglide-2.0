// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useOnlineStatus,
  setOnlineStatus,
  reportNetworkError,
  reportNetworkSuccess,
} from '../useOnlineStatus';

describe('useOnlineStatus (ADR 009)', () => {
  beforeEach(() => {
    act(() => {
      setOnlineStatus(true);
    });
  });

  afterEach(() => {
    act(() => {
      setOnlineStatus(true);
    });
  });

  it('inicia en estado online por defecto', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('cambia a offline cuando se llama a reportNetworkError', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      reportNetworkError();
    });

    expect(result.current).toBe(false);
  });

  it('se recupera a online cuando se llama a reportNetworkSuccess', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      reportNetworkError();
    });
    expect(result.current).toBe(false);

    act(() => {
      reportNetworkSuccess();
    });
    expect(result.current).toBe(true);
  });

  it('responde a eventos nativos de window online y offline', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
