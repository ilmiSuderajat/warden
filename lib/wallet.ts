import { supabase } from './supabase'

export interface Transaction {
  id: string
  seq: number
  type: 'payment' | 'refund' | 'topup' | 'withdraw' | 'commission'
  amount: number
  balance_after: number
  description: string
  created_at: string
}

/**
 * Mengambil saldo wallet user yang sedang login
 */
export async function getWalletBalance(): Promise<number> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return 0 // Not found implies 0 balance
    throw new Error(`Failed to fetch wallet balance: ${error.message}`)
  }

  return Number(data.balance)
}

/**
 * Mengambil riwayat transaksi user, terbaru di atas
 */
export async function getTransactionHistory(): Promise<Transaction[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('transactions')
    .select('id, seq, type, amount, balance_after, description, created_at')
    .eq('user_id', user.id)
    .order('seq', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch transaction history: ${error.message}`)
  }

  return data as Transaction[]
}

/**
 * Topup saldo — amount dalam Rupiah (angka bulat positif)
 */
export async function topupWallet(amount: number): Promise<void> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('Topup amount must be a positive integer')
  }

  const { error } = await supabase.rpc('topup_wallet', { p_amount: amount })

  if (error) {
    throw new Error(`Failed to topup wallet: ${error.message}`)
  }
}

/**
 * Bayar order menggunakan saldo wallet
 * idempotencyKey harus di-generate di sisi client (misal: crypto.randomUUID())
 */
export async function processPayment(
  orderId: string,
  idempotencyKey: string
): Promise<void> {
  if (!orderId) throw new Error('Order ID is required')
  if (!idempotencyKey) throw new Error('Idempotency key is required')

  const { error } = await supabase.rpc('process_payment', {
    p_order_id: orderId,
    p_idempotency_key: idempotencyKey
  })

  if (error) {
    throw new Error(`Payment failed: ${error.message}`)
  }
}

/**
 * Batalkan order (user cancel)
 */
export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<void> {
  if (!orderId) throw new Error('Order ID is required')
  if (!reason) throw new Error('Cancel reason is required')

  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
    p_actor: 'user',
    p_reason: reason
  })

  if (error) {
    throw new Error(`Cancel failed: ${error.message}`)
  }
}
