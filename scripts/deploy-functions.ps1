# Deploy Supabase Edge Functions + apply migrations.
# Prerequisites: `supabase` CLI installed, then:
#   supabase login
#   supabase link --project-ref <PROJECT_REF>
# Apply DB schema (migrations 0001-0003):
#   supabase db push
# Deploy functions:
#   supabase functions deploy telegram-bot --no-verify-jwt
#   supabase functions deploy api --no-verify-jwt
#   supabase functions deploy scheduler --no-verify-jwt
# Set secrets (Dashboard -> Project Settings -> API / Edge Functions):
#   BOT_TOKEN, TELEGRAM_SECRET, OPENROUTER_API_KEY, OPENROUTER_MODELS,
#   FREE_DAILY_QUOTA=2, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# Enable pg_cron job (SQL) to POST to /scheduler every 5 min.
Write-Host "Run the commands above after 'supabase login' + 'supabase link'."
