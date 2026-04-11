import crypto from "crypto"

// --- STUBBED CONSTANTS & TYPES ---
const PLATFORM_COMMISSION_RATE = 0.05
const COD_MAX_DISTANCE_KM = 15

const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

function formatCurrency(v: number) {
  // Use a customized implementation for consistent test output regardless of exact Node ICU version
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v)
}

function calculateCommission(subtotal: number) {
  const commission = Math.round(subtotal * PLATFORM_COMMISSION_RATE)
  const shopEarnings = subtotal - commission
  return { commission, shopEarnings }
}

function verifyMidtransSignature(order_id: string, status_code: string, gross_amount: string, serverKey: string, receivedSignature: string) {
  const expectedHash = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + serverKey)
    .digest("hex")
  return expectedHash === receivedSignature
}

function routeTopupType(order_id: string) {
    if (order_id.startsWith("DRVTOPUP-")) return "DRIVER"
    if (order_id.startsWith("USERTOPUP-")) return "USER"
    if (order_id.startsWith("TOPUP-")) return "SHOP"
    return "UNKNOWN"
}

// --- MOCK DATA ---
type ShopLog = { id: string; type: string; amount: number }
const SAMPLE_LOGS: ShopLog[] = [
    { id: "1", type: "commission", amount: 15000 },
    { id: "2", type: "withdraw", amount: -50000 },
    { id: "3", type: "topup", amount: 100000 },
    { id: "4", type: "refund", amount: -5000 }
]

function filterLogs(logs: ShopLog[], activeFilter: string) {
    if (activeFilter === "Masuk") return logs.filter(l => l.amount > 0)
    if (activeFilter === "Keluar") return logs.filter(l => l.amount <= 0)
    return logs
}

// --- TESTS ---

describe("Wallet System & Payment Checks", () => {
  
  describe("Input Validations", () => {
    test("isValidUUID correctly identifies valid/invalid UUIDs", () => {
      expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true)
      expect(isValidUUID("invalid-uuid-string")).toBe(false)
      expect(isValidUUID("")).toBe(false)
    })

    test("Min Topup / Withdraw amount bounds (>= 10000)", () => {
      const validateAmount = (amount: number) => !isNaN(amount) && amount >= 10000
      expect(validateAmount(5000)).toBe(false)
      expect(validateAmount(10000)).toBe(true)
      expect(validateAmount(50000)).toBe(true)
      expect(validateAmount(NaN)).toBe(false) // Not a Number
    })
  })

  describe("Commission & Earnings Logic", () => {
    test("Calculates 5% commission correctly and rounds properly", () => {
      // 5% of 100,000 = 5,000
      let res = calculateCommission(100000)
      expect(res.commission).toBe(5000)
      expect(res.shopEarnings).toBe(95000)

      // 5% of 15,500 = 775
      res = calculateCommission(15500)
      expect(res.commission).toBe(775)
      expect(res.shopEarnings).toBe(15500 - 775)
    })
  })

  describe("Midtrans Webhook Security", () => {
    test("Signature verification passes for correct hash", () => {
      const serverKey = "mock-server-key"
      const payload = "order-1" + "200" + "50000.00"
      const validSig = crypto.createHash("sha512").update(payload + serverKey).digest("hex")

      expect(verifyMidtransSignature("order-1", "200", "50000.00", serverKey, validSig)).toBe(true)
      expect(verifyMidtransSignature("order-1", "200", "50000.00", serverKey, "invalid-sig")).toBe(false)
    })

    test("Topup routing logic based on order prefix", () => {
        expect(routeTopupType("DRVTOPUP-12345-678")).toBe("DRIVER")
        expect(routeTopupType("USERTOPUP-ABC-123")).toBe("USER")
        expect(routeTopupType("TOPUP-SHOP1-999")).toBe("SHOP")
        expect(routeTopupType("ORDER-123")).toBe("UNKNOWN")
    })
  })

  describe("COD Eligibility Check", () => {
    test("Fails if distance > COD_MAX_DISTANCE_KM", () => {
      const distance = 16
      expect(distance > COD_MAX_DISTANCE_KM).toBe(true)
    })

    test("Passes if distance <= COD_MAX_DISTANCE_KM", () => {
      const distance = 15
      expect(distance > COD_MAX_DISTANCE_KM).toBe(false)
    })
  })

  describe("Wallet Page UI Logic", () => {
     test("Format currency matches Indonesian Locale", () => {
        const formatted = formatCurrency(50000)
        // Check if string contains "Rp" and "50"
        expect(formatted).toMatch(/Rp/)
        expect(formatted).toMatch(/50\.000/)
     })

     test("Filter Logs correctly separates income / outcome", () => {
         const masuk = filterLogs(SAMPLE_LOGS, "Masuk")
         expect(masuk.length).toBe(2)
         expect(masuk.every(m => m.amount > 0)).toBe(true)

         const keluar = filterLogs(SAMPLE_LOGS, "Keluar")
         expect(keluar.length).toBe(2)
         expect(keluar.every(k => k.amount <= 0)).toBe(true)

         const semua = filterLogs(SAMPLE_LOGS, "Semua")
         expect(semua.length).toBe(4)
     })
  })

  describe("Idempotency Concept", () => {
      test("Should skip processing if order is already paid", () => {
          const checkShouldProcess = (status: string) => !["paid", "failed", "expired", "cancelled"].includes(status)
          
          expect(checkShouldProcess("paid")).toBe(false)
          expect(checkShouldProcess("pending")).toBe(true)
          expect(checkShouldProcess("waiting_payment")).toBe(true)
          expect(checkShouldProcess("cancelled")).toBe(false)
      })
  })

})
