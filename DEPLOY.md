# Deploying the Laal web app to Fly.io

The Next.js web app deploys to Fly via the root `Dockerfile` + `fly.toml`
(standalone output, scale-to-zero). The Expo mobile app ships separately (EAS),
not to Fly.

## One-time setup

```bash
# 1. Install + log in
brew install flyctl          # or: curl -L https://fly.io/install.sh | sh
fly auth login

# 2. Create the app (name must match `app` in fly.toml; change both if taken)
fly apps create laal

# 3. Set server-only secrets (read at runtime, never baked into the image)
fly secrets set \
  SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..." \
  STRIPE_SECRET_KEY="sk_live_or_test_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  RESEND_API_KEY="re_..."
```

> Public values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
> `NEXT_PUBLIC_APP_URL`) are already in `fly.toml` (`[build.args]` for the client
> bundle, `[env]` for the server). They are public by design. Set
> `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `[build.args]` once you have it.

## Deploy

```bash
fly deploy            # builds the Dockerfile remotely and releases
```

## Custom domain (laal.app)

```bash
fly certs add laal.app
fly certs add www.laal.app
# then add the A/AAAA (or CNAME) records Fly prints, at your DNS provider
fly ips list          # the addresses to point DNS at
```

After the domain is live, keep `NEXT_PUBLIC_APP_URL=https://laal.app` (it's used
for Stripe redirect/return URLs and email links). If you deploy without the
custom domain first, temporarily set it to `https://laal.fly.dev`.

## Stripe webhook

Point a Stripe webhook endpoint at `https://laal.app/api/stripe/webhook` and put
its signing secret in `STRIPE_WEBHOOK_SECRET` (via `fly secrets set`).

## Notes

- **Scale to zero:** `min_machines_running = 0` — the machine sleeps when idle
  (cheapest) and cold-starts on the next request. Set it to `1` to avoid cold
  starts.
- **Logs / status:** `fly logs`, `fly status`, `fly ssh console`.
- **Build locally to test the image:** `docker build -t laal .` from the repo
  root (needs the same `--build-arg NEXT_PUBLIC_*` values).
