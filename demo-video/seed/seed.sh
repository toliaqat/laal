#!/usr/bin/env bash
# Reset the LOCAL Supabase stack to the demo-video starting state.
#   - creates the demo accounts if missing (admin, organizer, supporter)
#   - uploads the portraits to the local public bucket
#   - applies demo-seed.sql (campaigns, trust rows, supporter wall)
# Never points at production: the URLs below are the `supabase start` defaults.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres
API=http://127.0.0.1:54321
SERVICE_ROLE=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.demo | cut -d= -f2-)
PASSWORD=LaalDemo2026

ensure_user() { # email, full name
  curl -sS -o /dev/null -w "user $1 -> %{http_code}\n" -X POST "$API/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$2\"}}"
}
ensure_user organizer@laal.demo "Ayesha Rahman"   # admin (reviews fundraisers)
ensure_user hamza@laal.demo     "Hamza Hussain"   # organizer (starts a fundraiser on camera)
ensure_user sara@laal.demo      "Sara Malik"      # supporter

psql -q "$DB" -c "insert into storage.buckets (id,name,public) values ('laal-public','laal-public',true),('laal-documents','laal-documents',false) on conflict (id) do update set public = excluded.public"
for f in assets/portraits/*.jpg; do
  n=$(basename "$f")
  curl -sS -o /dev/null -w "portrait $n -> %{http_code}\n" -X POST "$API/storage/v1/object/laal-public/demo/$n" \
    -H "Authorization: Bearer $SERVICE_ROLE" -H "Content-Type: image/jpeg" -H "x-upsert: true" --data-binary "@$f"
done

psql -q "$DB" -f seed/demo-seed.sql
# Optional language edition on top (e.g. `seed.sh ur` → Urdu titles, stories, messages).
LANG_EDITION="${1:-en}"
if [ "$LANG_EDITION" != "en" ]; then psql -q "$DB" -f "seed/demo-seed-${LANG_EDITION}.sql"; fi
psql "$DB" -c "select slug, status, deceased_name, amount_raised, goal_amount, published_at::date from campaigns order by created_at desc"
