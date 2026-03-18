#!/bin/sh
set -e

BASE_URL="http://nextjs:3000"
AUTH="Authorization: Bearer ${SYNC_SECRET}"
CONTENT="Content-Type: application/json"
NOW=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

echo "[$NOW] Starting game sync"

# Step 1: Sync game statuses & resolve cards
RESPONSE=$(curl -sf -X POST "$BASE_URL/api/games/sync-status" \
  -H "$AUTH" -H "$CONTENT" 2>&1) || {
  echo "[$NOW] ERROR: sync-status failed: $RESPONSE"
}

# Step 2: Expire stale challenges
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/challenges/expire" \
  -H "$AUTH" -H "$CONTENT") || true
if [ "$HTTP_CODE" != "200" ]; then
  echo "[$NOW] WARN: challenges/expire returned HTTP $HTTP_CODE"
fi

# Step 3: Compute daily recaps
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/recaps/compute" \
  -H "$AUTH" -H "$CONTENT") || true
if [ "$HTTP_CODE" != "200" ]; then
  echo "[$NOW] WARN: recaps/compute returned HTTP $HTTP_CODE"
fi

echo "[$NOW] Game sync complete"
