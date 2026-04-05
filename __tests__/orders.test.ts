/**
 * Unit tests untuk fitur Pesanan (Orders)
 * Menguji: logika filter tab, status display, filtering query, dan helper functions
 *
 * NOTE: Test ini menguji logic murni (pure functions) yang di-extract dari orders/page.tsx
 * Komponen React full tidak ditest di sini karena memerlukan Supabase + Next.js router mock
 * yang kompleks — sebaiknya gunakan integration/e2e test (Playwright) untuk itu.
 */

// ─── TYPE ──────────────────────────────────────────────────────────────────────
interface Order {
  id: string
  status: string
  payment_status: string
  total_amount: number
  subtotal_amount: number
  shipping_amount: number
  discount_amount: number
  created_at: string
  address: string
  customer_name: string
  order_items: OrderItem[]
  driver_orders?: DriverOrder[]
  distance_km?: number
}

interface OrderItem {
  id: string
  product_id: string
  product_name: string
  price: number
  quantity: number
  image_url: string
}

interface DriverOrder {
  delivery_photo_url: string | null
}

// ─── STATUS CONFIG (copied from page.tsx) ─────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  "Menunggu Pembayaran": { label: "Belum Bayar",   color: "text-orange-600", bg: "bg-orange-50 border-orange-100",   dot: "bg-orange-500" },
  "Perlu Dikemas":       { label: "Dikemas",        color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100",   dot: "bg-indigo-500" },
  "Diproses":            { label: "Diproses",       color: "text-blue-600",   bg: "bg-blue-50 border-blue-100",       dot: "bg-blue-500"   },
  "Mencari Kurir":       { label: "Mencari Kurir",  color: "text-amber-600",  bg: "bg-amber-50 border-amber-100",     dot: "bg-amber-500"  },
  "Kurir Menuju Lokasi": { label: "Kurir Menuju",   color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100",   dot: "bg-indigo-500" },
  "Kurir di Toko":       { label: "Kurir di Toko",  color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100",   dot: "bg-indigo-500" },
  "Dikirim":             { label: "Dikirim",        color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100",   dot: "bg-indigo-500" },
  "Kurir di Lokasi":     { label: "Tiba",           color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-100", dot: "bg-emerald-500" },
  "Selesai":             { label: "Selesai",        color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-100", dot: "bg-emerald-500" },
  "Dibatalkan":          { label: "Dibatalkan",     color: "text-slate-500",  bg: "bg-slate-50 border-slate-200",     dot: "bg-slate-400"  },
  "Kurir Tidak Tersedia":{ label: "Kurir N/A",      color: "text-rose-600",   bg: "bg-rose-50 border-rose-100",       dot: "bg-rose-500"   },
}

function getStatusDisplay(order: Order) {
  const isUnpaid = order.payment_status === "pending" || order.status === "Menunggu Pembayaran"
  const key = isUnpaid ? "Menunggu Pembayaran" : order.status
  return STATUS_CONFIG[key] ?? { label: order.status, color: "text-slate-500", bg: "bg-slate-50 border-slate-200", dot: "bg-slate-400" }
}

function isUnpaid(order: Order): boolean {
  return order.payment_status === "pending" || order.status === "Menunggu Pembayaran"
}

// ─── FILTER LOGIC (mirrors Supabase query logic) ──────────────────────────────
function filterOrdersByTab(orders: Order[], tab: string): Order[] {
  switch (tab) {
    case "pending":
      return orders.filter(o => o.payment_status === "pending" || o.status === "Menunggu Pembayaran")
    case "dikemas":
      return orders.filter(o => o.payment_status === "paid" && ["Perlu Dikemas", "Diproses"].includes(o.status))
    case "dikirim":
      return orders.filter(o => ["Mencari Kurir", "Kurir Menuju Lokasi", "Kurir di Toko", "Dikirim", "Kurir di Lokasi", "Kurir Tidak Tersedia"].includes(o.status))
    case "selesai":
      return orders.filter(o => o.status === "Selesai")
    case "dibatalkan":
      return orders.filter(o => o.status === "Dibatalkan")
    case "all":
    default:
      return orders
  }
}

// ─── FORMAT DATE ──────────────────────────────────────────────────────────────
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  })
}

// ─── PRODUCT NAME PARSER ──────────────────────────────────────────────────────
function parseProductName(rawName: string): string {
  return rawName.split(" | ")[0]
}

// ─── TEST DATA ────────────────────────────────────────────────────────────────
const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "order-uuid-1234",
  status: "Selesai",
  payment_status: "paid",
  total_amount: 50000,
  subtotal_amount: 40000,
  shipping_amount: 10000,
  discount_amount: 0,
  created_at: "2026-04-05T08:00:00Z",
  address: "Jl. Merdeka No. 1, Jakarta",
  customer_name: "Budi Santoso",
  order_items: [
    { id: "item-1", product_id: "prod-1", product_name: "Nasi Goreng Special | shop-uuid-abc", price: 20000, quantity: 2, image_url: "/food.jpg" }
  ],
  ...overrides,
})

const SAMPLE_ORDERS: Order[] = [
  makeOrder({ id: "o1", status: "Menunggu Pembayaran", payment_status: "pending" }),
  makeOrder({ id: "o2", status: "Perlu Dikemas",       payment_status: "paid"    }),
  makeOrder({ id: "o3", status: "Mencari Kurir",       payment_status: "paid"    }),
  makeOrder({ id: "o4", status: "Dikirim",             payment_status: "paid"    }),
  makeOrder({ id: "o5", status: "Selesai",             payment_status: "paid"    }),
  makeOrder({ id: "o6", status: "Dibatalkan",          payment_status: "paid"    }),
  makeOrder({ id: "o7", status: "Diproses",            payment_status: "paid"    }),
  makeOrder({ id: "o8", status: "Kurir di Toko",       payment_status: "paid"    }),
  makeOrder({ id: "o9", status: "Kurir di Lokasi",     payment_status: "paid"    }),
]


// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Orders — isUnpaid()", () => {
  test("returns true when payment_status is pending", () => {
    const order = makeOrder({ payment_status: "pending", status: "Menunggu Pembayaran" })
    expect(isUnpaid(order)).toBe(true)
  })

  test("returns true when status is 'Menunggu Pembayaran' even if payment_status missing", () => {
    const order = makeOrder({ payment_status: "", status: "Menunggu Pembayaran" })
    expect(isUnpaid(order)).toBe(true)
  })

  test("returns false when payment_status is paid and status is not Menunggu Pembayaran", () => {
    const order = makeOrder({ payment_status: "paid", status: "Perlu Dikemas" })
    expect(isUnpaid(order)).toBe(false)
  })

  test("returns false for Selesai order", () => {
    const order = makeOrder({ payment_status: "paid", status: "Selesai" })
    expect(isUnpaid(order)).toBe(false)
  })
})


describe("Orders — getStatusDisplay()", () => {
  test("unpaid order shows 'Belum Bayar' label with orange color", () => {
    const order = makeOrder({ payment_status: "pending", status: "Menunggu Pembayaran" })
    const result = getStatusDisplay(order)
    expect(result.label).toBe("Belum Bayar")
    expect(result.color).toContain("orange")
    expect(result.dot).toContain("orange")
  })

  test("'Perlu Dikemas' shows indigo label 'Dikemas'", () => {
    const order = makeOrder({ status: "Perlu Dikemas", payment_status: "paid" })
    const result = getStatusDisplay(order)
    expect(result.label).toBe("Dikemas")
    expect(result.color).toContain("indigo")
  })

  test("'Selesai' shows emerald color", () => {
    const order = makeOrder({ status: "Selesai", payment_status: "paid" })
    const result = getStatusDisplay(order)
    expect(result.label).toBe("Selesai")
    expect(result.color).toContain("emerald")
  })

  test("'Dibatalkan' shows neutral slate color", () => {
    const order = makeOrder({ status: "Dibatalkan", payment_status: "paid" })
    const result = getStatusDisplay(order)
    expect(result.label).toBe("Dibatalkan")
    expect(result.color).toContain("slate")
  })

  test("unknown status falls back to status string itself", () => {
    const order = makeOrder({ status: "Status Baru Tidak Dikenal", payment_status: "paid" })
    const result = getStatusDisplay(order)
    expect(result.label).toBe("Status Baru Tidak Dikenal")
  })

  test("'Mencari Kurir' status shows amber badge", () => {
    const order = makeOrder({ status: "Mencari Kurir", payment_status: "paid" })
    const result = getStatusDisplay(order)
    expect(result.label).toBe("Mencari Kurir")
    expect(result.color).toContain("amber")
  })
})


describe("Orders — filterOrdersByTab()", () => {
  test("tab 'all' returns all orders unfiltered", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "all")
    expect(result).toHaveLength(SAMPLE_ORDERS.length)
  })

  test("tab 'pending' returns only unpaid orders", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "pending")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("o1")
  })

  test("tab 'pending' includes both payment_status=pending AND status=Menunggu Pembayaran", () => {
    const extraOrder = makeOrder({ id: "o-extra", status: "Menunggu Pembayaran", payment_status: "" })
    const result = filterOrdersByTab([...SAMPLE_ORDERS, extraOrder], "pending")
    expect(result.map(o => o.id)).toContain("o-extra")
  })

  test("tab 'dikemas' returns only paid orders in packaging states", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "dikemas")
    expect(result.map(o => o.status)).toEqual(expect.arrayContaining(["Perlu Dikemas", "Diproses"]))
    // Must be paid
    result.forEach(o => expect(o.payment_status).toBe("paid"))
  })

  test("tab 'dikemas' does NOT include 'Mencari Kurir'", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "dikemas")
    const statuses = result.map(o => o.status)
    expect(statuses).not.toContain("Mencari Kurir")
  })

  test("tab 'dikirim' includes all in-transit statuses", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "dikirim")
    const statuses = result.map(o => o.status)
    expect(statuses).toContain("Mencari Kurir")
    expect(statuses).toContain("Dikirim")
    expect(statuses).toContain("Kurir di Toko")
    expect(statuses).toContain("Kurir di Lokasi")
  })

  test("tab 'dikirim' does NOT include 'Selesai' or 'Dibatalkan'", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "dikirim")
    const statuses = result.map(o => o.status)
    expect(statuses).not.toContain("Selesai")
    expect(statuses).not.toContain("Dibatalkan")
  })

  test("tab 'selesai' returns only Selesai orders", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "selesai")
    const statuses = result.map(o => o.status)
    expect(statuses).toContain("Selesai")
    expect(statuses).not.toContain("Dibatalkan")
  })

  test("tab 'dibatalkan' returns only Dibatalkan orders", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "dibatalkan")
    const statuses = result.map(o => o.status)
    expect(statuses).toContain("Dibatalkan")
    expect(statuses).not.toContain("Selesai")
  })

  test("tab 'selesai' does NOT include in-progress orders", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "selesai")
    const statuses = result.map(o => o.status)
    expect(statuses).not.toContain("Perlu Dikemas")
    expect(statuses).not.toContain("Dikirim")
  })

  test("empty order array always returns empty for any tab", () => {
    const tabs = ["all", "pending", "dikemas", "dikirim", "selesai", "dibatalkan"]
    tabs.forEach(tab => {
      expect(filterOrdersByTab([], tab)).toHaveLength(0)
    })
  })

  test("unknown tab value falls through to return all orders", () => {
    const result = filterOrdersByTab(SAMPLE_ORDERS, "random-tab")
    expect(result).toHaveLength(SAMPLE_ORDERS.length)
  })
})


describe("Orders — parseProductName()", () => {
  test("strips shop ID from product_name", () => {
    expect(parseProductName("Nasi Goreng Special | shop-uuid-abc")).toBe("Nasi Goreng Special")
  })

  test("returns original string if no pipe separator", () => {
    expect(parseProductName("Ayam Bakar")).toBe("Ayam Bakar")
  })

  test("handles product name with multiple pipes — takes only first segment", () => {
    expect(parseProductName("Produk | A | B")).toBe("Produk")
  })

  test("handles empty string", () => {
    expect(parseProductName("")).toBe("")
  })
})


describe("Orders — formatDate()", () => {
  test("formats ISO date string to Indonesian locale", () => {
    const result = formatDate("2026-04-05T08:00:00Z")
    // Should include the number 5 (day)
    expect(result).toMatch(/5/)
    // Should include the year 2026
    expect(result).toMatch(/2026/)
  })

  test("different dates produce different output", () => {
    const date1 = formatDate("2026-01-01T00:00:00Z")
    const date2 = formatDate("2026-12-31T00:00:00Z")
    expect(date1).not.toBe(date2)
  })
})


describe("Orders — Tab coverage completeness", () => {
  test("every sample order appears in at least one tab (no orphan orders)", () => {
    const tabs = ["pending", "dikemas", "dikirim", "selesai", "dibatalkan"]
    SAMPLE_ORDERS.forEach(order => {
      const appearsInTab = tabs.some(tab => filterOrdersByTab([order], tab).length > 0)
      expect(appearsInTab).toBe(true)
    })
  })

  test("paid orders in packaging state: NOT in pending tab", () => {
    const packedOrder = makeOrder({ status: "Perlu Dikemas", payment_status: "paid" })
    const result = filterOrdersByTab([packedOrder], "pending")
    expect(result).toHaveLength(0)
  })

  test("after shop packs: order moves from 'pending' to 'proses' perspective (Mencari Kurir → dikirim tab)", () => {
    // Simulate: order was "Perlu Dikemas" (dikemas tab), shop clicks → "Mencari Kurir"
    const packed = makeOrder({ status: "Perlu Dikemas", payment_status: "paid" })
    const dispatched = { ...packed, status: "Mencari Kurir" }

    expect(filterOrdersByTab([packed], "dikemas")).toHaveLength(1)
    expect(filterOrdersByTab([dispatched], "dikemas")).toHaveLength(0) // gone from dikemas
    expect(filterOrdersByTab([dispatched], "dikirim")).toHaveLength(1) // now in dikirim
  })
})
