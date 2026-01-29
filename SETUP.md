# LottoLedger Setup Guide

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be fully provisioned (takes ~2 minutes)

### 3. Run Database Migrations

1. In Supabase Dashboard, go to **SQL Editor**
2. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run** to execute the migration
4. Copy and paste the contents of `supabase/migrations/002_seed_data.sql`
5. Click **Run** to seed initial data

### 4. Create Storage Bucket

1. In Supabase Dashboard, go to **Storage**
2. Click **New bucket**
3. Name it: `receipts`
4. Make it **Public**
5. Click **Create bucket**

### 5. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Get your Supabase credentials:
   - Go to **Settings** → **API** in Supabase Dashboard
   - Copy the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy the **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Add them to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 6. Create Users

#### Option A: Using Supabase Dashboard

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add user** → **Create new user**
3. Enter email and password
4. Note the user ID from the users table

5. Go to **SQL Editor** and run:
   ```sql
   INSERT INTO public.users (id, name, role)
   VALUES ('user-id-from-step-4', 'Admin Name', 'ADMIN');
   ```

   Or for staff:
   ```sql
   INSERT INTO public.users (id, name, role)
   VALUES ('user-id-from-step-4', 'Staff Name', 'STAFF');
   ```

#### Option B: Using Supabase Auth UI (Recommended)

1. Start the dev server: `npm run dev`
2. Go to `http://localhost:3000/login`
3. Click "Sign up" (you'll need to add a signup page or use Supabase Dashboard)
4. After creating the user, update their role in the database as shown above

### 7. Start Development Server

```bash
npm run dev
```

### 8. Access the Application

- Open [http://localhost:3000](http://localhost:3000)
- Login with your admin or staff credentials

## Testing the Application

### Staff Workflow

1. Login as staff
2. Go to **Box Entries** tab
3. Enter opening and closing numbers for boxes
4. Go to **Reports** tab
5. Upload lottery reports (with or without images)
6. Upload POS receipt
7. Go to **Player Credit** tab
8. Add a player and record transactions

### Admin Workflow

1. Login as admin
2. View dashboard metrics
3. Check **Ticket Mismatches** for any continuity issues
4. View **Player Balances**
5. Check **Weekly Analytics** for trends

## Troubleshooting

### "Failed to fetch" errors

- Check that your `.env.local` file has correct Supabase credentials
- Ensure Supabase project is active (not paused)

### "Row Level Security" errors

- Verify migrations ran successfully
- Check that RLS policies are enabled in Supabase Dashboard

### Storage upload errors

- Ensure `receipts` bucket exists and is public
- Check bucket policies in Supabase Storage settings

### Authentication errors

- Verify user exists in `auth.users` table
- Ensure user has corresponding entry in `public.users` table with role set

## Production Deployment

1. Build the app: `npm run build`
2. Deploy to Vercel/Netlify/etc.
3. Add environment variables in your hosting platform
4. Update Supabase project settings for production URLs
5. Run migrations on production database

## Support

For issues or questions, check:
- Supabase documentation: https://supabase.com/docs
- Next.js documentation: https://nextjs.org/docs
