#!/usr/bin/env bash
# Publish the web cut of the demo to the PUBLIC R2 bucket, where the landing
# page hero loads it from (apps/web/lib/demo-video.ts).
#
#   demo-video/pipeline/publish.sh            # upload v1 (default)
#   DEMO_VERSION=v2 demo-video/pipeline/publish.sh
#
# Bump the version here AND in apps/web/lib/demo-video.ts whenever the video
# changes: the objects are cached for a year as immutable.
#
# Inputs (built by `make web-assets`, see below):
#   build/web/laal-demo-1080p.mp4   the walkthrough, 1080p, with sound
#   build/web/laal-demo-teaser.mp4  silent 15 s loop for the hero card
# The poster ships in the repo (apps/web/public/demo/laal-demo-poster.jpg).
#
# Credentials come from the repo's ../.env (R2_* — the same account token the
# app uses to upload cover images). Requires the AWS CLI.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${DEMO_VERSION:-v2}"

# Read only the R2_* lines (the file is not shell-safe as a whole: values with
# spaces and angle brackets).
while IFS='=' read -r k v; do
  case "$k" in R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_PUBLIC_BUCKET|R2_PUBLIC_BASE_URL) export "$k=$v";; esac
done < <(grep -E '^R2_' ../.env)
: "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}" "${R2_PUBLIC_BUCKET:?}" "${R2_PUBLIC_BASE_URL:?}"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

put() { # local, remote key
  aws s3 cp "$1" "s3://${R2_PUBLIC_BUCKET}/$2" --endpoint-url "$ENDPOINT" \
    --content-type video/mp4 --cache-control "public, max-age=31536000, immutable" --only-show-errors
  echo "  ✓ ${R2_PUBLIC_BASE_URL}/$2"
}
for sfx in "" "-ur"; do   # every language edition that has been built
  [ -f "build/web/laal-demo${sfx}-1080p.mp4" ] || continue
  put "build/web/laal-demo${sfx}-1080p.mp4"  "site/demo/laal-demo${sfx}-1080p.${VERSION}.mp4"
  put "build/web/laal-demo${sfx}-teaser.mp4" "site/demo/laal-demo${sfx}-teaser.${VERSION}.mp4"
done
