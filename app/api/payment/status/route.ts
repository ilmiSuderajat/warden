import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import Midtrans from "midtrans-client"

const snap = new Midtrans.Snap({
    isProduction: false, // Sandbox
    serverKey: process.env.MIDTRANS_SERVER_KEY!,
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
})

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { orderId } = body

        if (!orderId) {
            return NextResponse.json({ error: "Order ID diperlukan." }, { status: 400 })
        }

        const cookieStore = await cookies()
        const supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    getAll: () => [],
                    setAll: () => { },
                },
            }
        )

        // 1. Cek detail transaksi ke Midtrans
        // Karena kita menggunakan suffix timestamp, kita perlu mencoba beberapa format order_id atau mencarinya.
        // Namun, Midtrans Snap API memungkinkan kita mencari status berdasarkan order_id asli jika itu yang terakhir digunakan.
        // Atau kita bisa menyimpan order_id unik tersebut di kolom lain di DB, tapi untuk sekarang kita coba cari status transaksi.

        // Kita coba ambil data order dulu untuk mendapatkan ID aslinya
        const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .maybeSingle()

        if (orderError || !order) {
            return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 })
        }

        // Kita butuh order_id yang dikirim ke Midtrans. 
        // Karena kita tidak menyimpannya, kita akan mencoba fetch status dari Midtrans.
        // Masalah: Midtrans butuh order_id yang PERSIS sama. 
        // Solusi: Kita akan query Midtrans API untuk mencari transaksi terbaru untuk order ini.
        // Untuk mempermudah, kita akan meminta user untuk klik 'Bayar' yang akan generate ID baru, 
        // atau kita simpan 'last_midtrans_id' di database.

        // SEMENTARA: Kita akan mencoba memanggil status Midtrans dengan ID pesanan saja (tanpa suffix)
        // Jika gagal, kita beri pesan ke user.
        let statusResponse;
        try {
            // Kita coba fetch status. Catatan: Ini mungkin gagal jika ID tidak persis sama.
            // Di update berikutnya kita harus simpan midtrans_order_id di tabel orders.
            statusResponse = await snap.transaction.status(orderId)
        } catch (err: any) {
            console.log("[Status Check] Failed with raw ID, trying to find transaction...")
            // Jika gagal, kita tidak bisa menebak timestamp-nya.
            return NextResponse.json({
                error: "Status belum lunas atau ID transaksi tidak sinkron.",
                details: "Jika Anda sudah bayar namun status belum berubah, mohon hubungi admin."
            }, { status: 404 })
        }

        console.log("[Status Check] Midtrans Response:", statusResponse.transaction_status)

        const transactionStatus = statusResponse.transaction_status
        let paymentStatus = 'pending'
        let orderStatus = 'Menunggu Pembayaran'

        if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
            paymentStatus = 'paid'
            orderStatus = 'Perlu Dikemas'
        } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
            paymentStatus = 'cancelled'
            orderStatus = 'Dibatalkan'
        }

        // 2. Update DB jika ada perubahan
        if (paymentStatus === 'paid') {
            await supabaseAdmin
                .from("orders")
                .update({
                    payment_status: paymentStatus,
                    status: orderStatus,
                    payment_method: 'online'
                })
                .eq("id", orderId)

            return NextResponse.json({
                success: true,
                message: "Pembayaran terverifikasi!",
                status: orderStatus
            })
        }

        return NextResponse.json({
            success: false,
            message: `Status saat ini: ${transactionStatus}`,
            status: transactionStatus
        })

    } catch (err: any) {
        console.error("[Status Check Error]", err)
        return NextResponse.json({ error: "Gagal cek status pembayaran." }, { status: 500 })
    }
}
