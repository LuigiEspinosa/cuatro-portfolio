// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { GET } from '../route';

/**
 * The real `NextResponse`, never a mock of it (DW-144, DW-155). The external keyword monitor in
 * `ops/monitoring.md` asserts the literal substring `"status":"ok"` against the bytes on the wire,
 * so a case that read the plain object back would stay green while pretty-printing or an envelope
 * took that substring off the wire. Each case reads the serialized body.
 */
describe('GET /api/health', () => {
  it('serializes the exact substring the keyword monitor asserts', async () => {
    const text = await GET().text();
    expect(text).toContain('"status":"ok"');
  });

  it('answers 200 as JSON', () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('returns a version string and a non-negative uptime', async () => {
    const body = JSON.parse(await GET().text());
    expect(typeof body.version).toBe('string');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});
