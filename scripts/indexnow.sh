#!/usr/bin/env bash
# IndexNow for a site served by GitHub Pages: tells the search engines which pages a deploy changed, after it is live.
#
#   HOST=docs.example.com KEY=<hex key> ENTRY=sitemap.xml scripts/indexnow.sh snapshot   before the build, saves the live sitemap
#   HOST=... KEY=... ENTRY=... scripts/indexnow.sh ping <dist>                           after the deploy job, submits what changed
#
# The protocol: https://www.indexnow.org/documentation. The key is public by design and is served by the site at /<KEY>.txt
# (the site's own static folder carries the file). `ping` waits until the live site serves the key file and a sitemap
# identical to the one just built (so a page cache that still holds the old deploy is never read as "nothing changed"),
# then POSTs the URLs that are new or whose <lastmod> moved since the snapshot, up to 10,000 per POST; 200 and 202 are success.
# It runs only in the deploy workflow's job that needs the deploy job, never at build time.
set -euo pipefail
HOST=${HOST:?}; KEY=${KEY:?}; ENTRY=${ENTRY:?}
ENDPOINT=${INDEXNOW_ENDPOINT:-https://api.indexnow.org/indexnow}
BASE=${SITE_BASE_OVERRIDE:-https://$HOST}
WORK=${INDEXNOW_DIR:-indexnow}
mkdir -p "$WORK/before"

flat() { printf '%s' "$1" | tr '/' '_'; }
locs() { grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g'; }
# every "loc lastmod" pair of a sitemap file
pairs() { sed 's#</url>#</url>\n#g' "$1" | sed -nE 's#.*<loc>([^<]+)</loc>(<lastmod>([^<]*)</lastmod>)?.*#\1 \3#p'; }
# the sitemap files an entry names: the entry itself, and, if it is an index, each child (path under the host)
children() { grep -q '<sitemapindex' "$1" && locs < "$1" | sed -E 's#^https?://[^/]+/##' || true; }

case "${1:-}" in
snapshot)
  # A first deploy has no live sitemap yet; that is fine, everything is then new.
  if curl -fsS -m 30 "$BASE/$ENTRY" -o "$WORK/before/$(flat "$ENTRY")"; then
    for c in $(children "$WORK/before/$(flat "$ENTRY")"); do curl -fsS -m 60 "$BASE/$c" -o "$WORK/before/$(flat "$c")" || true; done
  fi
  echo "snapshot: $(ls "$WORK/before" | wc -l) sitemap file(s) saved"
  ;;
ping)
  DIST=${2:?dist dir}
  files=("$ENTRY"); for c in $(children "$DIST/$ENTRY"); do files+=("$c"); done
  ok=0
  for i in $(seq 1 45); do
    good=1
    served=$(curl -fsS -m 15 "$BASE/$KEY.txt" 2>/dev/null | tr -d '\r\n ' || true)
    [ "$served" = "$KEY" ] || good=0
    for f in "${files[@]}"; do
      a=$(curl -fsS -m 30 "$BASE/$f" 2>/dev/null | sha256sum | cut -c1-64 || true); b=$(sha256sum < "$DIST/$f" | cut -c1-64)
      [ "$a" = "$b" ] || good=0
    done
    if [ "$good" = 1 ]; then ok=1; break; fi
    echo "waiting for the deploy to serve the new sitemap and the key file ($i/45)"; sleep 20
  done
  [ "$ok" = 1 ] || { echo "::error::$HOST never served its key file and the new sitemap"; exit 1; }

  : > "$WORK/new"; : > "$WORK/old"
  for f in "${files[@]}"; do pairs "$DIST/$f" >> "$WORK/new"; done
  for f in "${files[@]}"; do [ -f "$WORK/before/$(flat "$f")" ] && pairs "$WORK/before/$(flat "$f")" >> "$WORK/old" || true; done
  sort -u "$WORK/old" -o "$WORK/old"
  # new or moved: a (loc, lastmod) pair that was not in the live sitemap before this deploy
  sort -u "$WORK/new" | comm -13 "$WORK/old" - | awk -v h="https://$HOST/" 'index($1,h)==1 {print $1}' | sort -u > "$WORK/urls"
  n=$(wc -l < "$WORK/urls"); echo "$n URLs new or changed since the previous deploy"
  [ "$n" -gt 0 ] || { echo "nothing to submit for $HOST"; exit 0; }
  rm -f "$WORK"/chunk.*; split -l 10000 "$WORK/urls" "$WORK/chunk."
  rc=0
  for chunk in "$WORK"/chunk.*; do
    jq -n --arg host "$HOST" --arg key "$KEY" --arg loc "https://$HOST/$KEY.txt" --rawfile urls "$chunk" \
      '{host:$host, key:$key, keyLocation:$loc, urlList:($urls | split("\n") | map(select(length > 0)))}' > "$WORK/payload.json"
    code=000
    for attempt in 1 2 3; do
      code=$(curl -sS -m 60 -o "$WORK/response" -w '%{http_code}' -X POST "$ENDPOINT" -H 'Content-Type: application/json; charset=utf-8' --data @"$WORK/payload.json" || echo 000)
      case "$code" in 200|202) break ;; esac
      echo "attempt $attempt: HTTP $code $(head -c 300 "$WORK/response" 2>/dev/null)"; sleep $((attempt * 15))
    done
    echo "IndexNow $HOST: HTTP $code for $(wc -l < "$chunk") URLs"
    case "$code" in 200|202) ;; *) echo "::error::IndexNow refused $HOST with HTTP $code"; rc=1 ;; esac
  done
  exit $rc
  ;;
*) echo "usage: indexnow.sh snapshot | ping <dist>" >&2; exit 2 ;;
esac
