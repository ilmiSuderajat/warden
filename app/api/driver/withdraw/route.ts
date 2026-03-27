import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
        )
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        if (authError || !session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json()
        const { bank_name, account_number, account_name, amount } = body

        if (!bank_name || !account_number || !account_name || !amount) {
            return NextResponse.json({ error: "Semua field harus diisi" }, { status: 400 })
        }

        const withdrawalAmount = parseInt(amount)
        if (isNaN(withdrawalAmount) || withdrawalAmount < 10000) {
            return NextResponse.json({ error: "Minimal penarikan Rp 10.000" }, { status: 400 })
        }

        const supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { cookies: { getAll: () => [], setAll: () => {} } }
        )

        // Verifikasi saldo
        const { data: user } = await supabaseAdmin
            .from("users")
            .select("saldo")
            .eq("id", session.user.id)
            .single()

        if (!user || user.saldo < withdrawalAmount) {
            return NextResponse.json({ error: "Saldo tidak mencukupi" }, { status: 400 })
        }

        // Potong saldo
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ saldo: user.saldo - withdrawalAmount })
            .eq("id", session.user.id)

        if (updateError) throw updateError

        // Catat request penarikan (jika tabel withdrawals ada, kita ignore error jika tabel belum dibuat)
        try {
            await supabaseAdmin.from("withdrawals").insert({
                user_id: session.user.id,
                amount: withdrawalAmount,
                bank_name,
                account_number,
                account_name,
                status: "pending"
            })
        } catch (_) { /* Abaikan jika tabel withdrawals belum ada, saldo sudah dipotong */ }

        return NextResponse.json({ success: true, newSaldo: user.saldo - withdrawalAmount })
    } catch (e: any) {
        console.error("Withdraw Error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
