import { NextResponse } from "next/server"
import { dispatchOrder } from "@/lib/dispatch"

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json()
        
        if (!orderId) {
            return NextResponse.json({ error: "orderId is required" }, { status: 400 })
        }

        const result = await dispatchOrder(orderId)

        if (!result.success) {
            return NextResponse.json(result, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error("Dispatch Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
