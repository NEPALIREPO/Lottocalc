#!/bin/bash

# Script to create admin user via Supabase Management API
# Requires SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF environment variables

set -e

EMAIL="admin@admin.com"
PASSWORD="adminadmin"
NAME="Admin User"
ROLE="ADMIN"

if [ -z "$SUPABASE_ACCESS_TOKEN" ] || [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF must be set"
  echo ""
  echo "To get these values:"
  echo "1. Go to Supabase Dashboard > Settings > API"
  echo "2. Copy your Project Reference (project ref)"
  echo "3. Go to Account Settings > Access Tokens"
  echo "4. Create a new access token"
  echo ""
  echo "Then run:"
  echo "  export SUPABASE_ACCESS_TOKEN='your-token'"
  echo "  export SUPABASE_PROJECT_REF='your-project-ref'"
  echo "  ./scripts/create-admin-user.sh"
  exit 1
fi

echo "Creating admin user..."

# Create user via Supabase Management API
RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/auth/users" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"email_confirm\": true,
    \"user_metadata\": {
      \"role\": \"${ROLE}\"
    }
  }")

USER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "Error: Failed to create user. Response:"
  echo "$RESPONSE"
  exit 1
fi

echo "User created with ID: $USER_ID"

# Now insert into public.users table
echo "Setting user role in database..."

# You'll need to run this SQL in Supabase SQL Editor:
echo ""
echo "Run this SQL in Supabase SQL Editor:"
echo "-----------------------------------"
echo "INSERT INTO public.users (id, name, role)"
echo "VALUES ('${USER_ID}', '${NAME}', '${ROLE}')"
echo "ON CONFLICT (id) DO UPDATE"
echo "SET role = '${ROLE}', name = '${NAME}', updated_at = NOW();"
echo "-----------------------------------"
