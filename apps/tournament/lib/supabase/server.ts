import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Request-scoped SSR Supabase clients (@supabase/ssr) that read/write the auth session
 * cookies. Two shapes:
 *
 *  - `createSupabaseServerClient()` — for Server Components / reads, cookies via
 *    `next/headers`.
 *  - `createSupabaseRouteClient(request, response)` — for Route Handlers that must WRITE
 *    session cookies onto a specific response (e.g. the login callback redirect). Binding
 *    writes to the outgoing `NextResponse` is the reliable way to attach `Set-Cookie` to a
 *    redirect.
 */

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env.publicSupabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `set` throws when called from a Server Component render; safe to ignore —
          // session refresh is handled where a response is available.
        }
      },
    },
  });
}

export function createSupabaseRouteClient(request: NextRequest, response: NextResponse) {
  return createServerClient(env.publicSupabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
}
