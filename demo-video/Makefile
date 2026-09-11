# Laal demo video — build pipeline
#
#   make all            seed → record → narrate → assemble
#   make record U=help  re-record one unit (help, start, review, home, …)
#   make narrate        regenerate the voice-over after a script edit
#   make assemble       re-cut the final video from what is in build/
#   make script         regenerate script/SCRIPT.md from the storyboard
#
# Prerequisites (one-time): `supabase start`, Python 3.11 with playwright +
# Pillow, ffmpeg, the Stripe CLI logged in. See README.md.

PY ?= /opt/homebrew/opt/python@3.11/bin/python3.11
# Language edition: `make record LANG=ur`, `make narrate LANG=ur`, `make assemble LANG=ur`
LANG ?= en
UNITS ?= cards home browse fundraiser help start review mobile
U ?= $(UNITS)

.PHONY: all seed record narrate assemble script clean web stripe check

all: seed record narrate assemble

seed:
	./seed/seed.sh $(LANG)

record: check
	$(PY) pipeline/record.py --lang $(LANG) $(U)

narrate:
	$(PY) pipeline/narrate.py --lang $(LANG)

assemble:
	$(PY) pipeline/assemble.py --lang $(LANG)

script:
	$(PY) pipeline/script_md.py

# Start the web app against the LOCAL Supabase (never production).
web:
	cd .. && set -a && . ./demo-video/.env.demo && set +a && pnpm --filter @laal/web dev

# Forward Stripe test-mode webhooks so paid donations land on the supporter wall.
stripe:
	stripe listen --forward-to localhost:3000/api/stripe/webhook

check:
	@curl -sf -o /dev/null $${DEMO_BASE_URL:-http://localhost:3000}/en || (echo "web app is not running — run 'make web' in another terminal"; exit 1)
	@curl -sf -o /dev/null http://127.0.0.1:54321/rest/v1/ -H "apikey: x" || (echo "local Supabase is not running — run 'supabase start'"; exit 1)

clean:
	rm -rf build/frames build/scenes build/cards build/filtergraph.txt

# Web cut for the landing page hero (1080p + silent teaser + poster), then publish to R2.
web-assets:
	$(PY) pipeline/web_assets.py

publish:
	./pipeline/publish.sh
