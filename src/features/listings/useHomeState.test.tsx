import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const setParams = vi.fn();
vi.mock('react-router', () => ({
  useSearchParams: () => [new URLSearchParams(), setParams],
}));

const { useHomeState } = await import('./homeState');

describe('useHomeState', () => {
  // Controlled inputs driven by transition-wrapped router updates lose keystrokes
  it('updates the URL synchronously so controlled inputs keep up', () => {
    const { result } = renderHook(() => useHomeState());
    act(() => result.current[1]({ view: 'table' }));
    expect(setParams).toHaveBeenLastCalledWith(expect.any(URLSearchParams), {
      replace: true,
      flushSync: true,
    });
  });
});
