#!/bin/bash
# Mark migrations 001-034 as already applied so db push only runs 035 and 036.
# Run from project root: ./scripts/repair-migrations.sh

set -e
cd "$(dirname "$0")/.."

# Version is the numeric prefix (001, 002, ... 034)
for v in 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 021 022 023 024 025 026 027 028 029 030 031 032 033 034; do
  echo "Repairing $v..."
  npx supabase migration repair "$v" --status applied --linked
done

echo "Done. Run: npx supabase db push"
