import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"

export async function POST(req: Request) {
    try {
        const admin = await getAuthenticatedUser()
        if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const supabaseAdmin = createAdminClient()

        // 1. Verifikasi role admin (Cek table users DAN table admins)
        const { data: userRecord } = await supabaseAdmin
            .from("users")
            .select("role")
            .eq("id", admin.id)
            .single()

        const { data: adminRecord } = await supabaseAdmin
            .from("admins")
            .select("id")
            .eq("user_id", admin.id)
            .maybeSingle()

        if (userRecord?.role !== "admin" && !adminRecord) {
            return NextResponse.json({ error: "Akses ditolak. Fitur ini khusus Admin." }, { status: 403 })
        }

        const body = await req.json()
        const { id, type } = body

        if (!id || !type) {
            return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 })
        }

        let table = ""
        if (type === "driver") table = "driver_withdraw_requests"
        else if (type === "shop") table = "shop_withdraw_requests"
        else if (type === "user") table = "user_withdraw_requests"
        else return NextResponse.json({ error: "Tipe penarikan tidak valid" }, { status: 400 })

        // 2. Ambil request current status
        const { data: request, error: reqErr } = await supabaseAdmin
            .from(table)
            .select("status")
            .eq("id", id)
            .single()

        if (reqErr || !request) {
            return NextResponse.json({ error: "Request penarikan tidak ditemukan" }, { status: 404 })
        }

        if (request.status !== "pending") {
            return NextResponse.json({ error: `Request sudah diproses (${request.status})` }, { status: 400 })
        }

        // 3. Update status jadi approved
        // NOTE: Saldo SUDAH DIPOTONG saat pembuatan request, jadi kita hanya perlu update status.
        const { error: updateErr } = await supabaseAdmin
            .from(table)
            .update({ status: "approved" })
            .eq("id", id)

        if (updateErr) throw updateErr

        return NextResponse.json({ success: true, message: "Penarikan dana disetujui" })
    } catch (err: any) {
        console.error("[Approve Withdraw Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal" }, { status: 500 })
    }
}
