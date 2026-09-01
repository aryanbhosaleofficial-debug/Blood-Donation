import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App.jsx';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

describe('StrictMode startup request coordination', () => {
  it('issues one health probe and one logged-out auth probe without requesting CSRF', async () => {
    const requests = [];
    global.fetch = vi.fn(async (url) => {
      requests.push(String(url));
      if (String(url).endsWith('/health')) {
        return new Response(JSON.stringify({ data: { status: 'ok', db: 'ok', schemaVersion: 6 } }), {
          status: 200,
        });
      }
      if (String(url).endsWith('/auth/me')) {
        return new Response(
          JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'You must be signed in.' } }),
          { status: 401 },
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );

    expect(await screen.findByText('Operational')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Access Platform')).toBeInTheDocument());

    expect(requests.filter((url) => url.endsWith('/health'))).toHaveLength(1);
    expect(requests.filter((url) => url.endsWith('/auth/me'))).toHaveLength(1);
    expect(requests.filter((url) => url.endsWith('/auth/csrf-token'))).toHaveLength(0);
  });
});
