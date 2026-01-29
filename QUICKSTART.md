# Quick Start Guide

Get LottoLedger running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)

## Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/migrations/002_seed_data.sql`
4. Go to **Storage** → Create bucket `receipts` (public)

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Add your Supabase credentials:
- **Settings** → **API** → Copy URL and anon key
- Paste into `.env.local`

### 4. Create Users

**Admin User:**
1. See `CREATE_ADMIN_USER.md` for detailed instructions
2. Email: `admin@admin.com`, Password: `adminadmin`
3. Or run migration `014_create_staff_user.sql` after creating the auth user

**Staff User:**
1. See `CREATE_STAFF_USER.md` for detailed instructions
2. Email: `staff@k2market.com`, Password: (set your preferred password)
3. Or run migration `014_create_staff_user.sql` after creating the auth user

**Quick Method:**
1. **Authentication** → **Users** → **Add user**
   - Email: `admin@admin.com` or `staff@k2market.com`
   - Password: (your choice)
   - Auto Confirm: ✅ Yes
2. **SQL Editor** → Run the appropriate migration:
   - `003_create_admin_user.sql` for admin
   - `014_create_staff_user.sql` for staff

### 5. Start Development Server

```bash
npm run dev
```

### 6. Login

- Go to http://localhost:3000
- Login with your credentials
- Start using the app!

## First Steps After Login

### As Staff:
1. Go to **Box Entries** tab
2. Enter opening/closing numbers for boxes
3. Upload lottery reports
4. Upload POS receipt
5. Add players and record transactions

### As Admin:
1. View dashboard metrics
2. Check ticket mismatches
3. Review player balances
4. Analyze weekly trends

## Common Issues

**"Failed to fetch"**
- Check `.env.local` has correct Supabase URL/key
- Ensure Supabase project is active

**"Row Level Security" error**
- Verify migrations ran successfully
- Check RLS policies in Supabase

**Storage upload fails**
- Ensure `receipts` bucket exists and is public
- Check bucket policies

## Next Steps

- Read `SETUP.md` for detailed setup
- Read `README.md` for full documentation
- Check `PROJECT_STRUCTURE.md` for code organization

## Support

- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
