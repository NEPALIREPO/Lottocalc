# LottoLedger

Production-ready web application for retail lottery + grocery store management.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Auth + Postgres + Storage)
- **Tailwind CSS** + **Shadcn UI**
- **Tesseract.js** (Client-side OCR)
- **Recharts** (Data visualization)

## Features

### Staff Features
- Daily box entry (opening/closing ticket numbers)
- Upload lottery reports (Instant Report 34, Special Report 50)
- Upload POS terminal receipts
- Manage player credit transactions
- OCR extraction from receipt images

### Admin Features
- Dashboard with key metrics
- Ticket mismatch detection and logging
- Cash expectations calculation
- Weekly deposit calculations
- Staff integrity metrics
- Player balance tracking
- Analytics charts (weekly cash flow, sales breakdown)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a new Supabase project
   - Run the migrations in `supabase/migrations/001_initial_schema.sql`
   - Run the seed data in `supabase/migrations/002_seed_data.sql`
   - Create a storage bucket named `receipts` with public access
   - Copy your Supabase URL and anon key

3. **Configure environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   Then add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Create users:**
   - **Admin user:** See `CREATE_ADMIN_USER.md` for detailed instructions
     - Email: `admin@admin.com`
     - Password: `adminadmin`
   - **Staff user:** See `CREATE_STAFF_USER.md` for detailed instructions
     - Email: `staff@k2market.com`
     - Password: (set your preferred password)
   - Or manually sign up users through Supabase Auth UI and update the `users` table to set their role

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

## Database Schema

- `users` - User accounts with roles (ADMIN/STAFF)
- `boxes` - Lottery ticket boxes
- `daily_box_entries` - Daily opening/closing numbers
- `ticket_continuity_logs` - Mismatch detection logs
- `lottery_reports` - Instant and special reports
- `pos_reports` - POS terminal receipts
- `players` - Credit players
- `player_transactions` - Player credit transactions

## Business Logic

### Scratch Sale Calculation
```
(close_number - open_number) * ticket_value
```

### Ticket Continuity Check
Automatically compares yesterday's closing number with today's opening number. Creates a log entry if mismatch detected.

### Expected Cash Formula
```
scratch_cash + online_cash + grocery_cash - lottery_cashes - player_wins
```

## Routes

- `/login` - Authentication
- `/staff/dashboard` - Staff entry forms
- `/admin/dashboard` - Admin analytics and reports

## Security

- Row Level Security (RLS) enabled on all tables
- Role-based access control (ADMIN/STAFF)
- Middleware protection for admin routes
- Server-side authentication checks

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy to Vercel, Netlify, or your preferred platform

3. Ensure environment variables are set in your deployment platform

4. Configure Supabase production database and storage

## License

Proprietary - For internal use only
