import { NextResponse } from 'next/server';

const startTime = Date.now();

/**
 * A monitored contract: the external keyword monitor (`ops/monitoring.md`) alerts when the body
 * lacks the literal substring `"status":"ok"`, so the body stays compact JSON with `status` at its
 * top level. Pretty-printing it or wrapping it in an envelope reads as the Hub being down.
 * `__tests__/route.test.ts` asserts the serialized form.
 */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.APP_VERSION ?? 'unknown',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
}
