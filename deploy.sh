#!/bin/bash

echo "🚀 LottoLedger Vercel Deployment Script"
echo "========================================"
echo ""

# Check if logged in
if ! vercel whoami &>/dev/null; then
    echo "📝 Step 1: Login to Vercel"
    echo "Please complete the login process in your browser..."
    vercel login
fi

echo ""
echo "✅ Logged in as: $(vercel whoami)"
echo ""

# Check if .env.local exists to get Supabase credentials
if [ -f .env.local ]; then
    echo "📋 Found .env.local file"
    source .env.local
    echo "Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
    echo ""
fi

echo "📦 Step 2: Deploying to Vercel..."
echo ""

# Deploy (first time will ask questions)
vercel

echo ""
echo "🔐 Step 3: Adding Environment Variables..."
echo ""

# Add environment variables if they exist
if [ ! -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "Adding NEXT_PUBLIC_SUPABASE_URL..."
    echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
    echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
    echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL development
fi

if [ ! -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..."
    echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
    echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
    echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development
fi

echo ""
echo "🚀 Step 4: Deploying to Production..."
echo ""

vercel --prod

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Update Supabase Auth redirect URLs:"
echo "   - Go to Supabase Dashboard → Authentication → URL Configuration"
echo "   - Add your Vercel URL: https://your-project.vercel.app/**"
echo ""
echo "2. Test your deployment:"
echo "   - Visit your Vercel URL"
echo "   - Try logging in"
echo "   - Test all features"
echo ""
