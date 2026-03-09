import { NextResponse } from 'next/server';

const startTime = Date.now();

export function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.APP_VERSION ?? 'unknown',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
}
