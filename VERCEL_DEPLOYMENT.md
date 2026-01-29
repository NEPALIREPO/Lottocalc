# Vercel Deployment Guide for LottoLedger

This guide will help you deploy the LottoLedger application to Vercel.

## Prerequisites

1. A GitHub account with the repository pushed
2. A Vercel account (sign up at https://vercel.com)
3. Your Supabase project URL and anon key

## Step 1: Push to GitHub (if not already done)

```bash
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Sign in or create an account

2. **Import Your Project**
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select the repository containing LottoLedger

3. **Configure Project Settings**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

4. **Add Environment Variables**
   Click "Environment Variables" and add:
   
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   
   **Important**: 
   - Get these values from your Supabase project settings
   - Make sure to add them for all environments (Production, Preview, Development)

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project? No (first time)
   - Project name: lottoledger (or your preferred name)
   - Directory: ./
   - Override settings? No

4. **Add Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
   
   Enter the values when prompted.

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

## Step 3: Configure Supabase for Production

1. **Update Supabase Auth Settings**
   - Go to your Supabase project dashboard
   - Navigate to Authentication → URL Configuration
   - Add your Vercel domain to "Redirect URLs":
     - `https://your-project.vercel.app/**`
     - `https://your-project.vercel.app/auth/callback`

2. **Update RLS Policies (if needed)**
   - Ensure your Row Level Security policies work with the production domain
   - Test authentication flows after deployment

## Step 4: Post-Deployment Checklist

- [ ] Test login functionality (admin and staff)
- [ ] Verify OCR image upload works
- [ ] Check that Supabase Storage bucket is accessible
- [ ] Test daily box entry creation
- [ ] Verify reports are being saved correctly
- [ ] Check admin dashboard analytics
- [ ] Test player transaction creation

## Troubleshooting

### Build Errors

If you encounter build errors:

1. **Check Build Logs**
   - Go to your project in Vercel dashboard
   - Click on the failed deployment
   - Review the build logs for errors

2. **Common Issues**:
   - **Missing Environment Variables**: Ensure all required env vars are set
   - **TypeScript Errors**: Run `npm run build` locally to catch errors
   - **Module Not Found**: Check that all dependencies are in `package.json`

### Runtime Errors

1. **Check Function Logs**
   - Go to Vercel dashboard → Your Project → Functions
   - Review serverless function logs

2. **Common Issues**:
   - **CORS Errors**: Check Supabase CORS settings
   - **RLS Policy Errors**: Verify Row Level Security policies
   - **Storage Bucket Errors**: Ensure bucket exists and is public/accessible

### Environment Variables Not Working

1. **Redeploy After Adding Variables**
   - After adding environment variables, redeploy:
   ```bash
   vercel --prod
   ```

2. **Verify Variable Names**
   - Ensure variable names match exactly (case-sensitive)
   - `NEXT_PUBLIC_` prefix is required for client-side variables

## Custom Domain (Optional)

1. **Add Domain in Vercel**
   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update Supabase Redirect URLs**
   - Add your custom domain to Supabase Auth redirect URLs

## Continuous Deployment

Vercel automatically deploys when you push to:
- `main` branch → Production
- Other branches → Preview deployments

Each push triggers a new deployment automatically.

## Monitoring

- **Analytics**: Enable Vercel Analytics in project settings
- **Logs**: View real-time logs in Vercel dashboard
- **Performance**: Monitor Core Web Vitals in Vercel dashboard

## Support

- Vercel Documentation: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Supabase Documentation: https://supabase.com/docs
