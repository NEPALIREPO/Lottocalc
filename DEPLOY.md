# Quick Vercel Deployment

## Method 1: Vercel Dashboard (Easiest)

1. **Go to**: https://vercel.com/new
2. **Import** your GitHub repository
3. **Add Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = Your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Your Supabase Anon Key
4. **Click Deploy**

## Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (first time)
vercel

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

## After Deployment

1. Update Supabase Auth redirect URLs:
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add: `https://your-project.vercel.app/**`

2. Test your deployment:
   - Visit your Vercel URL
   - Try logging in with admin credentials
   - Test OCR upload functionality

## Your Environment Variables

Get these from your Supabase project settings:
- Project URL: Found in Project Settings → API
- Anon Key: Found in Project Settings → API
