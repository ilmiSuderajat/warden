import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env: any = fs.readFileSync(".env.local", "utf8").split("\n").reduce((acc: any, line) => {
    const [key, ...rest] = line.split("=");
    const value = rest.join("=");
    if (key && value) { acc[key.trim()] = value.trim(); process.env[key.trim()] = value.trim(); }
    return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
    // 1. Find all orders with 'Kurir Menuju Lokasi' or 'Dikirim' that have NO accepted driver_orders row
    const { data: orders } = await supabase.from("orders").select("id, status").in("status", ["Kurir Menuju Lokasi", "Mencari Kurir"]);
    const { data: assignedRows } = await supabase.from("driver_orders").select("order_id").in("status", ["accepted", "picked_up"]);
    const assignedOrderIds = new Set((assignedRows || []).map((r: any) => r.order_id));

    const orphaned = (orders || []).filter((o: any) => !assignedOrderIds.has(o.id));
    console.log("Orphaned orders (no driver assigned):", orphaned.map((o: any) => `${o.id} (${o.status})`));

    // 2. Reset orphaned orders to 'Perlu Dikemas' so admin can re-dispatch
    for (const order of orphaned) {
        const { error } = await supabase.from("orders").update({ status: "Perlu Dikemas" } as any).eq("id", order.id);
        if (error) console.log(`Failed to reset ${order.id}:`, error.message);
        else console.log(`Reset ${order.id} to Perlu Dikemas`);
    }

    console.log("\nDone! Orphaned orders reset. Admin can now click 'Siap Dikirim' to re-dispatch.");
}

fix();
