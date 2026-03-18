#!/bin/sh
set -e

BASE_URL="http://nextjs:3000"
AUTH="Authorization: Bearer ${SYNC_SECRET}"
CONTENT="Content-Type: application/json"
NOW=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

echo "[$NOW] Starting props sync"

# Step 1: Sync props from Odds API
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/props/sync" \
  -H "$AUTH" -H "$CONTENT") || true
if [ "$HTTP_CODE" != "200" ]; then
  echo "[$NOW] WARN: props/sync returned HTTP $HTTP_CODE"
fi

# Step 2: Backfill missing player headshots
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/props/backfill" \
  -H "$AUTH" -H "$CONTENT") || true
if [ "$HTTP_CODE" != "200" ]; then
  echo "[$NOW] WARN: props/backfill returned HTTP $HTTP_CODE"
fi

echo "[$NOW] Props sync complete"
