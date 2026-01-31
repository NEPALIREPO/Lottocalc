import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({
      request,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // If env vars are missing, allow request to proceed (will fail at page level with proper error)
    if (!supabaseUrl || !supabaseAnonKey) {
      return supabaseResponse;
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Invalid/expired refresh token → clear session and redirect to login
    const isInvalidRefreshToken =
      authError?.message?.includes('Refresh Token') ||
      authError?.message?.includes('refresh_token') ||
      (authError as { name?: string })?.name === 'AuthApiError';
    if (authError && isInvalidRefreshToken) {
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith('sb-') && name.includes('auth')) {
          response.cookies.set(name, '', { maxAge: 0, path: '/' });
        }
      });
      return response;
    }

    if (authError) {
      console.error('Proxy auth error:', authError);
      return supabaseResponse;
    }

    const { pathname } = request.nextUrl;

    // Fetch role from public.users table if user exists
    let userRole: string | null = null;
    if (user) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (userError) {
          console.error('Proxy user role fetch error:', userError);
          // Continue without role - page will handle auth
        } else {
          userRole = userData?.role || null;
        }
      } catch (error) {
        console.error('Proxy error fetching user role:', error);
        // Continue without role - page will handle auth
      }
    }

    // Protect admin routes
    if (pathname.startsWith('/admin') && (!user || userRole !== 'ADMIN')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Protect staff routes
    if (pathname.startsWith('/staff') && !user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Redirect authenticated users away from login
    if (pathname === '/login' && user) {
      if (userRole === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/staff/dashboard', request.url));
    }

    return supabaseResponse;
  } catch (error) {
    // Log error but don't block request - let page handle it
    console.error('Proxy updateSession error:', error);
    return NextResponse.next({
      request,
    });
  }
}
