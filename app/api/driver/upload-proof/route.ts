import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/driverOrders"

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const formData = await req.formData()
        const file = formData.get("file") as File
        const type = (formData.get("type") as string) || "proof" // "pickup" | "delivery"

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

        const ext = file.name.split(".").pop() || "jpg"
        const path = `driver-proofs/${session.user.id}/${type}_${Date.now()}.${ext}`

        const { error } = await supabaseAdmin.storage
            .from("driver-proofs")
            .upload(path, file, { contentType: file.type, upsert: true })

        if (error) throw error

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from("driver-proofs")
            .getPublicUrl(path)

        return NextResponse.json({ success: true, url: publicUrl })
    } catch (e: any) {
        console.error("Upload proof error:", e)
        return NextResponse.json({ error: e.message || "Upload failed" }, { status: 500 })
    }
}
