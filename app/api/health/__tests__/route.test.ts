import { describe, it, expect, vi } from 'vitest';
import { GET } from '../route';

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) => ({ json: async () => body }),
  },
}));

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const response = GET();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  it('returns a version string', async () => {
    const response = GET();
    const body = await response.json();
    expect(typeof body.version).toBe('string');
  });

  it('returns a non-negative uptime', async () => {
    const response = GET();
    const body = await response.json();
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});
