# LottoLedger Project Structure

```
Lottocalc/
├── app/                          # Next.js App Router
│   ├── admin/
│   │   ├── dashboard/
│   │   │   ├── page.tsx         # Admin dashboard server component
│   │   │   └── client.tsx       # Admin dashboard client component
│   │   └── layout.tsx            # Admin route protection
│   ├── staff/
│   │   ├── dashboard/
│   │   │   ├── page.tsx         # Staff dashboard server component
│   │   │   └── client.tsx       # Staff dashboard client component
│   │   └── layout.tsx            # Staff route protection
│   ├── login/
│   │   └── page.tsx             # Login page
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page (redirects)
│   └── globals.css               # Global styles
│
├── components/
│   └── ui/                       # Shadcn UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── loading.tsx
│       └── table.tsx
│
├── lib/
│   ├── actions/                  # Server actions
│   │   ├── boxes.ts             # Box CRUD operations
│   │   ├── continuity.ts        # Ticket continuity checks
│   │   ├── daily-entries.ts     # Daily box entries
│   │   ├── lottery-reports.ts   # Lottery report management
│   │   ├── players.ts           # Player & transaction management
│   │   ├── pos-reports.ts       # POS report management
│   │   └── storage.ts           # File upload helpers
│   ├── calculations.ts          # Business logic calculations
│   ├── ocr.ts                   # OCR processing utilities
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   ├── middleware.ts       # Auth middleware
│   │   └── server.ts            # Server Supabase client
│   └── utils.ts                 # Utility functions
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql  # Database schema
│       └── 002_seed_data.sql        # Seed data
│
├── middleware.ts                 # Next.js middleware
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── tailwind.config.ts           # Tailwind config
├── next.config.js               # Next.js config
├── README.md                    # Main documentation
├── SETUP.md                     # Setup instructions
└── .env.local.example           # Environment template
```

## Key Features by File

### Authentication & Authorization
- `middleware.ts` - Route protection
- `lib/supabase/middleware.ts` - Auth logic
- `app/admin/layout.tsx` - Admin-only routes
- `app/staff/layout.tsx` - Staff-only routes

### Staff Features
- `app/staff/dashboard/client.tsx` - Main staff interface
  - Box entry forms
  - Report uploads with OCR
  - Player credit management

### Admin Features
- `app/admin/dashboard/client.tsx` - Admin analytics
  - Dashboard metrics
  - Mismatch detection
  - Weekly charts
  - Player balances

### Business Logic
- `lib/calculations.ts` - Cash calculations, summaries
- `lib/ocr.ts` - Receipt text extraction
- `supabase/migrations/001_initial_schema.sql` - Database triggers for continuity checks

### Database
- Automatic ticket continuity checking via PostgreSQL trigger
- Computed columns for sold_count and sold_amount
- Row Level Security (RLS) policies
- Indexes for performance

## Data Flow

1. **Staff Entry Flow:**
   - Staff enters box numbers → `saveAllDailyBoxEntries` / `saveOpenNumbers` / `saveCloseNumbers`
   - Trigger checks continuity → `ticket_continuity_logs`
   - Staff uploads receipts → OCR extraction → Save reports

2. **Admin Analytics Flow:**
   - Fetch daily summary → `calculateDailySummary`
   - Fetch continuity logs → Display mismatches
   - Fetch weekly data → Generate charts

3. **Cash Calculation:**
   - Aggregates scratch sales, online sales, grocery sales
   - Subtracts lottery cashes and player wins
   - Displays expected cash for deposit
