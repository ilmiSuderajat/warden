import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAuthClient } from "@/lib/serverAuth"

const MIN_WITHDRAW = 10000

export async function POST(req: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json()
        const { amount, bank_name, account_number, account_name } = body

        const withdrawAmount = parseInt(amount)
        if (isNaN(withdrawAmount) || withdrawAmount < MIN_WITHDRAW) {
            return NextResponse.json({ error: `Minimal penarikan Rp ${MIN_WITHDRAW.toLocaleString("id-ID")}` }, { status: 400 })
        }

        if (!bank_name || !account_number || !account_name) {
            return NextResponse.json({ error: "Semua data rekening harus diisi." }, { status: 400 })
        }

        const supabaseAuth = await createAuthClient()

        // 1. Eksekusi RPC request_withdraw untuk memotong saldo secara atomic dan mencatat request
        const { data: requestId, error: rpcErr } = await supabaseAuth.rpc("request_withdraw", {
            p_amount: withdrawAmount,
            p_bank_name: bank_name,
            p_bank_account: account_number,
            p_bank_holder: account_name
        })

        if (rpcErr) {
            console.error("[User Withdraw RPC Error]", rpcErr)
            if (rpcErr.message?.includes("Insufficient balance")) {
                return NextResponse.json({ error: "Saldo tidak mencukupi." }, { status: 400 })
            }
            if (rpcErr.message?.includes("Amount must be greater")) {
                return NextResponse.json({ error: "Jumlah penarikan tidak valid." }, { status: 400 })
            }
            return NextResponse.json({ error: "Gagal memproses penarikan." }, { status: 500 })
        }

        return NextResponse.json({ success: true, requestId })
    } catch (err: any) {
        console.error("[User Withdraw Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 })
    }
}
