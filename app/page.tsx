import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('Auth error in Home:', authError);
      redirect('/login');
    }

    if (!user) {
      redirect('/login');
    }

    // Fetch role from public.users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('User role fetch error in Home:', userError);
      redirect('/login');
    }

    const role = userData?.role;
    if (role === 'ADMIN') {
      redirect('/admin/dashboard');
    }

    redirect('/staff/dashboard');
  } catch (error) {
    console.error('Error in Home page:', error);
    redirect('/login');
  }
}
