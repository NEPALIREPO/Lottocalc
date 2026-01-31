import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = {
    url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };

  if (!env.url || !env.anonKey) {
    return NextResponse.json(
      {
        ok: false,
        env,
        supabase: { ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' },
      },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getUser();

    return NextResponse.json({
      ok: true,
      env,
      supabase: { ok: !error, error: error?.message ?? null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        ok: false,
        env,
        supabase: { ok: false, error: message },
      },
      { status: 500 }
    );
  }
}
