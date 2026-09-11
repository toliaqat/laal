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
UNITS ?= cards home browse fundraiser help start review mobile
U ?= $(UNITS)

.PHONY: all seed record narrate assemble script clean web stripe check

all: seed record narrate assemble

seed:
	./seed/seed.sh

record: check
	$(PY) pipeline/record.py $(U)

narrate:
	$(PY) pipeline/narrate.py

assemble:
	$(PY) pipeline/assemble.py

script:
	$(PY) pipeline/script_md.py

# Start the web app against the LOCAL Supabase (never production).
web:
	cd .. && set -a && . ./demo-video/.env.demo && set +a && pnpm --filter @laal/web dev

# Forward Stripe test-mode webhooks so paid donations land on the supporter wall.
stripe:
	stripe listen --forward-to localhost:3000/api/stripe/webhook

check:
	@curl -sf -o /dev/null http://localhost:3000/en || (echo "web app is not running — run 'make web' in another terminal"; exit 1)
	@curl -sf -o /dev/null http://127.0.0.1:54321/rest/v1/ -H "apikey: x" || (echo "local Supabase is not running — run 'supabase start'"; exit 1)

clean:
	rm -rf build/frames build/scenes build/cards build/filtergraph.txt

# Web cut for the landing page hero (1080p + silent teaser + poster), then publish to R2.
web-assets:
	mkdir -p build/web ../apps/web/public/demo
	ffmpeg -y -loglevel error -i build/laal-demo-1920x1080.mp4 -c:v libx264 -crf 26 -preset slow -profile:v high -level 4.1 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart build/web/laal-demo-1080p.mp4
	ffmpeg -y -loglevel error -ss 25.6 -t 15 -i build/laal-demo-1920x1080.mp4 -an -vf "scale=1280:720,fade=t=in:st=0:d=0.5:color=0xf3eee4,fade=t=out:st=14.5:d=0.5:color=0xf3eee4" -c:v libx264 -crf 29 -preset slow -pix_fmt yuv420p -movflags +faststart build/web/laal-demo-teaser.mp4
	ffmpeg -y -loglevel error -ss 43.5 -i build/laal-demo-1920x1080.mp4 -frames:v 1 -vf scale=1280:720 -q:v 3 ../apps/web/public/demo/laal-demo-poster.jpg

publish:
	./pipeline/publish.sh
