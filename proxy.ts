import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const SESSION_TIMEOUT_MS = 8_000;

export async function proxy(request: NextRequest) {
  try {
    const response = await Promise.race([
      updateSession(request),
      new Promise<NextResponse>((resolve) =>
        setTimeout(() => resolve(NextResponse.next({ request })), SESSION_TIMEOUT_MS)
      ),
    ]);
    return response;
  } catch {
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
