import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build time (SSR), env vars might not be available
  // Provide fallback values to allow build to complete
  // These will be replaced with actual values at runtime when env vars are set
  const url = supabaseUrl || 'https://placeholder.supabase.co';
  const key = supabaseAnonKey || 'placeholder-key';

  // Validate in browser runtime (not during build/SSR)
  if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
    console.error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createBrowserClient(url, key);
}
