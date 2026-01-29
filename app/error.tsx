'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string; code?: string; details?: string; hint?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  const message = error?.message ?? 'Something went wrong';
  const code = (error as any)?.code ?? error?.digest;
  const details = (error as any)?.details;
  const hint = (error as any)?.hint;
  
  // Check if this is a Server Components render error (common when env vars missing)
  const isServerRenderError = code === '2704750074' || error?.digest === '2704750074';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-destructive">Runtime Error</CardTitle>
          <CardDescription>
            {code === '42P17' && (
              <span className="block mt-2 text-amber-600">
                PostgreSQL 42P17 = invalid object definition. Often caused by trigger/rule syntax or schema mismatch.
              </span>
            )}
            {isServerRenderError && (
              <span className="block mt-2 text-amber-600">
                Server Components render error. This often occurs when Supabase environment variables are missing.
                Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your deployment.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">
            {message}
          </div>
          {code && (
            <div className="text-sm">
              <span className="font-medium">Code:</span> <code className="bg-muted px-1 rounded">{code}</code>
            </div>
          )}
          {details && (
            <div className="text-sm">
              <span className="font-medium">Details:</span>
              <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-auto">{details}</pre>
            </div>
          )}
          {hint && (
            <div className="text-sm">
              <span className="font-medium">Hint:</span>
              <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-auto">{hint}</pre>
            </div>
          )}
          {isServerRenderError && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm">
              <p className="font-medium text-amber-900 mb-2">Troubleshooting Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-amber-800">
                <li>Verify environment variables are set in Vercel (Settings → Environment Variables)</li>
                <li>Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured</li>
                <li>Redeploy your application after adding environment variables</li>
                <li>Check Vercel build logs for any environment variable errors</li>
              </ol>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Go home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
