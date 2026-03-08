#!/bin/bash
# Mantua.AI Agent E2E Test Script
# Tests all /api/agent/* endpoints end-to-end.
# Run: chmod +x scripts/test-agent-flow.sh && ./scripts/test-agent-flow.sh
set -e

BASE="${BASE_URL:-http://localhost:5000}/api/agent"

echo ""
echo "═══════════════════════════════════════════"
echo " Mantua.AI Agent E2E Test"
echo " Target: $BASE"
echo "═══════════════════════════════════════════"

PASS=0
FAIL=0

check() {
  local label="$1"
  local pattern="$2"
  local response="$3"
  if echo "$response" | grep -qE "$pattern"; then
    echo "  ✅ PASS: $label"
    PASS=$((PASS+1))
  else
    echo "  ❌ FAIL: $label"
    echo "     Expected pattern: $pattern"
    echo "     Got: $(echo "$response" | head -c 300)"
    FAIL=$((FAIL+1))
  fi
}

# ── STEP 1: Agent Wallet (GET) ─────────────────────────────────────────────────
echo ""
echo "[ STEP 1 ] GET /api/agent/wallet — agent wallet details"
WALLET_RESP=$(curl -s "$BASE/wallet")
echo "$WALLET_RESP" | head -c 400
echo ""
check "wallet address present" "0x[a-fA-F0-9]{40}" "$WALLET_RESP"
check "response success" '"success":true' "$WALLET_RESP"

# ── STEP 2: Faucet via chat endpoint ──────────────────────────────────────────
echo ""
echo "[ STEP 2 ] POST /api/agent/chat — request testnet ETH"
FAUCET_RESP=$(curl -s -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Request testnet ETH from the faucet for my wallet. Show the tx hash.","action":"get-funds"}')
echo "$FAUCET_RESP" | head -c 400
echo ""
check "chat endpoint success" '"success":true' "$FAUCET_RESP"
# Note: faucet tx check — may show error if faucet is rate-limited
if echo "$FAUCET_RESP" | grep -qE "sepolia.basescan.org/tx/0x|faucet|transaction"; then
  echo "  ✅ PASS: faucet response contains tx/faucet mention"
  PASS=$((PASS+1))
else
  echo "  ⚠️  WARN: faucet tx link not found — faucet may be rate-limited"
fi

# ── STEP 3: Price query via chat ───────────────────────────────────────────────
echo ""
echo "[ STEP 3 ] POST /api/agent/chat — ETH price query"
PRICE_RESP=$(curl -s -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the current ETH price in USD?"}')
echo "$PRICE_RESP" | head -c 400
echo ""
check "chat endpoint success" '"success":true' "$PRICE_RESP"
check "price data present" '[0-9]+' "$PRICE_RESP"

# ── STEP 4: Autonomous mode — balance query ───────────────────────────────────
echo ""
echo "[ STEP 4 ] POST /api/agent/autonomous — balance query"
AUTO_RESP=$(curl -s -X POST "$BASE/autonomous" \
  -H "Content-Type: application/json" \
  -d '{"message":"Show my wallet balance"}')
echo "$AUTO_RESP" | head -c 400
echo ""
check "autonomous success" '"success":true' "$AUTO_RESP"
check "balance/address data" '0x[a-fA-F0-9]{40}|ETH|balance|wallet' "$AUTO_RESP"

# ── STEP 5: Autonomous mode — price query ─────────────────────────────────────
echo ""
echo "[ STEP 5 ] POST /api/agent/autonomous — ETH price"
PRICE_AUTO=$(curl -s -X POST "$BASE/autonomous" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the current ETH price?"}')
echo "$PRICE_AUTO" | head -c 400
echo ""
check "autonomous price success" '"success":true' "$PRICE_AUTO"

# ── STEP 6: Autonomous mode — wallet details ──────────────────────────────────
echo ""
echo "[ STEP 6 ] POST /api/agent/autonomous — wallet details"
WALLET_AUTO=$(curl -s -X POST "$BASE/autonomous" \
  -H "Content-Type: application/json" \
  -d '{"message":"Get my wallet details"}')
echo "$WALLET_AUTO" | head -c 400
echo ""
check "autonomous wallet success" '"success":true' "$WALLET_AUTO"
check "wallet intent detected" '"intent":"create-wallet"' "$WALLET_AUTO"

# ── STEP 7: Swap intent routing ───────────────────────────────────────────────
echo ""
echo "[ STEP 7 ] POST /api/agent/chat — swap request"
SWAP_RESP=$(curl -s -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Swap 0.000001 ETH for USDC","action":"swap"}')
echo "$SWAP_RESP" | head -c 400
echo ""
check "swap chat success" '"success":true' "$SWAP_RESP"

# ── SUMMARY ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " RESULTS: $PASS passed, $FAIL failed"
if [ $FAIL -eq 0 ]; then
  echo " ALL STEPS PASSED ✅"
else
  echo " $FAIL STEP(S) FAILED ❌"
  echo " Check that CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET,"
  echo " OPENAI_API_KEY, and IDEMPOTENCY_KEY are set in your environment."
fi
echo "═══════════════════════════════════════════"

[ $FAIL -eq 0 ]
