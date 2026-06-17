import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the API module so we can drive the auth probe.
vi.mock('./api', () => ({
  InsufficientScopeError: class InsufficientScopeError extends Error {},
  api: {
    me: vi.fn(),
    meta: vi.fn().mockResolvedValue({ version: '9.9.9', bin: 'fwknop', stanzas: [] }),
    presets: vi.fn().mockResolvedValue([]),
    history: vi.fn().mockResolvedValue([]),
    preview: vi.fn().mockResolvedValue({ command: 'fwknop' }),
    logout: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

import { api } from './api';
import { App } from './App';
import { ThemeProvider } from './theme';

const renderApp = () =>
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );

describe('App auth gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the login gate when unauthenticated', async () => {
    vi.mocked(api.me).mockResolvedValue({ authenticated: false });
    renderApp();
    await waitFor(() => expect(screen.getByText(/Sign in with SSO/i)).toBeInTheDocument());
    expect(api.meta).not.toHaveBeenCalled(); // protected calls are not made while gated
  });

  it('renders the console (no gate) in disabled/open mode', async () => {
    vi.mocked(api.me).mockResolvedValue({ disabled: true });
    renderApp();
    await waitFor(() => expect(api.meta).toHaveBeenCalled());
    expect(screen.queryByText(/Sign in with SSO/i)).not.toBeInTheDocument();
  });

  it('shows the user chip and sign-out when authenticated', async () => {
    vi.mocked(api.me).mockResolvedValue({
      authenticated: true,
      user: { sub: 'u1', name: 'Alice' },
      scopes: ['fwknop:read'],
    });
    renderApp();
    await waitFor(() => expect(screen.getByTitle('Sign out')).toBeInTheDocument());
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
