# Environment Variables Check

If you're seeing a Server Components render error (code: 2704750074), it's likely because Supabase environment variables are not set.

## Required Environment Variables

Make sure these are set in your Vercel deployment:

1. `NEXT_PUBLIC_SUPABASE_URL`
   - Get this from: Supabase Dashboard → Project Settings → API → Project URL
   - Example: `https://xxxxx.supabase.co`

2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Get this from: Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`
   - This is the public anon key (safe to expose in client-side code)

## How to Set in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add both variables for all environments (Production, Preview, Development)
4. **Redeploy** your application after adding variables

## Verify Variables Are Set

After deployment, check the build logs in Vercel to ensure:
- Variables are listed in the build output
- No errors about missing environment variables

## Common Issues

### Error: "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL"
- **Cause**: `NEXT_PUBLIC_SUPABASE_URL` is missing or invalid
- **Fix**: Ensure the URL is set and starts with `https://`

### Error: "Server Components render error"
- **Cause**: Environment variables not available at runtime
- **Fix**: 
  1. Verify variables are set in Vercel
  2. Ensure they're added for the correct environment (Production/Preview)
  3. Redeploy after adding variables

### Build succeeds but runtime fails
- **Cause**: Variables might be set for build but not runtime
- **Fix**: Make sure variables are set for all environments in Vercel

## Testing Locally

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Then run:
```bash
npm run dev
```
