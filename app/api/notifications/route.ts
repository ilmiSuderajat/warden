import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/serverAuth"
import { createNotification } from "@/lib/notifications"

/**
 * POST /api/notifications
 * Create a notification from a client-side action (e.g. after order creation).
 * The user_id is always taken from the authenticated session for safety.
 * Additional notifications (e.g. for the shop) can be sent by providing extra entries.
 */
export async function POST(req: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json()
        const { notifications } = body

        if (!Array.isArray(notifications) || notifications.length === 0) {
            return NextResponse.json({ error: "notifications array is required" }, { status: 400 })
        }

        const results = await Promise.all(
            notifications.map((n: any) => createNotification({
                userId: n.user_id || user.id,
                type: n.type,
                title: n.title,
                message: n.message,
                link: n.link,
                forShop: n.for_shop ?? false,
            }))
        )

        return NextResponse.json({ success: true, results })
    } catch (err: any) {
        console.error("[POST /api/notifications] Error:", err)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
