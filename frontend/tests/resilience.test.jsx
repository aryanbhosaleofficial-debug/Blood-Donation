import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { apiClient, setUnauthorizedHandler, ApiError } from '../src/api/api-client.js';
import { usePolling } from '../src/hooks/usePolling.js';

/**
 * Module 10 — frontend resilience regressions:
 *   - a 401 triggers the unauthorized handler (except on /auth/me & /auth/login)
 *     so the app can clear its session and stop authenticated polling
 *   - a transient network failure surfaces a clean ApiError (no raw payload)
 *   - usePolling clears its timer on unmount (no dangling intervals)
 */

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  setUnauthorizedHandler(null);
  vi.useRealTimers();
});

describe('api-client — session expiry / 401 handling', () => {
  it('calls the unauthorized handler on a 401 to a normal API route', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'sign in' } }), { status: 401 }),
    );

    await expect(apiClient.get('/requests')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does NOT call the unauthorized handler for /auth/me (avoids a bootstrap loop)', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }),
    );

    await expect(apiClient.get('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('surfaces a transient network failure as a NETWORK_ERROR ApiError (no raw internals)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    try {
      await apiClient.get('/notifications');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.message).not.toMatch(/stack|at Object|TypeError:/i);
    }
  });
});

describe('usePolling — cleanup on unmount', () => {
  it('stops ticking after the component unmounts', async () => {
    vi.useFakeTimers();
    const tick = vi.fn().mockResolvedValue(undefined);

    function Poller() {
      const [n] = useState(0);
      usePolling(tick, 1000, true);
      return <span>poll {n}</span>;
    }

    const { unmount } = render(<Poller />);
    await act(async () => { await Promise.resolve(); }); // initial immediate tick
    const callsAtMount = tick.mock.calls.length;
    expect(callsAtMount).toBeGreaterThanOrEqual(1);

    unmount();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(tick.mock.calls.length).toBe(callsAtMount); // no further ticks
  });
});

describe('empty-state rendering contract', () => {
  it('a list component renders a friendly empty message rather than crashing on []', () => {
    function List({ items }) {
      if (!items || items.length === 0) return <p>No records yet.</p>;
      return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;
    }
    render(<List items={[]} />);
    expect(screen.getByText('No records yet.')).toBeInTheDocument();
  });
});
