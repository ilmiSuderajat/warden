#!/bin/bash

# ============================================================
# Mock Midtrans Top-Up Webhook Script
# ============================================================
# Usage: ./mock-topup-webhook.sh <ORDER_ID> <AMOUNT>
# Example: ./mock-topup-webhook.sh USERTOPUP-8c836921-1775398473300 50000
# ============================================================

ORDER_ID=$1
AMOUNT=$2
SERVER_KEY="SB-Mid-server-MmcOxA8pyPlpzfRHHO41JC3X"
STATUS_CODE="200"

if [ -z "$ORDER_ID" ] || [ -z "$AMOUNT" ]; then
    echo "Usage: ./mock-topup-webhook.sh <ORDER_ID> <AMOUNT>"
    exit 1
fi

# 1. Calculate Signature Key (SHA512)
# Formula: order_id + status_code + gross_amount + server_key
PAYLOAD="${ORDER_ID}${STATUS_CODE}${AMOUNT}${SERVER_KEY}"
SIGNATURE_KEY=$(echo -n "$PAYLOAD" | sha512sum | awk '{print $1}')

echo "🚀 Sending mock webhook for Order: $ORDER_ID (Rp $AMOUNT)"
echo "🔑 Signature: $SIGNATURE_KEY"

# 2. Send POST request
curl -X POST http://localhost:3000/api/payment/topup-webhook \
     -H "Content-Type: application/json" \
     -d "{
       \"order_id\": \"$ORDER_ID\",
       \"status_code\": \"$STATUS_CODE\",
       \"gross_amount\": \"$AMOUNT\",
       \"signature_key\": \"$SIGNATURE_KEY\",
       \"transaction_status\": \"settlement\",
       \"payment_type\": \"qris\"
     }"

echo -e "\n✅ Request sent. Check your server logs for results."
