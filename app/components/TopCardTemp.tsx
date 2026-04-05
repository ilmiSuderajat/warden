"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ScanLine, Wallet, Coins, Ticket, Sparkles } from "lucide-react"
import useSWR from "swr"
import { supabase } from "@/lib/supabase"

const fetcher = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('wallets')
        .select('balance, points_balance')
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) throw error
    return data || { balance: 0, points_balance: 0 }
}

export default function TopCard() {
    const { data: wallet, error, isLoading } = useSWR('user_wallet', fetcher, {
        revalidateOnFocus: true,
        dedupingInterval: 10000, // 10 seconds cache
    })

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(val)
    }

    const WALLET_ITEMS = [
        {
            label: wallet ? formatCurrency(wallet.balance) : (isLoading ? "..." : "Rp 0"),
            subLabel: "Saldo",
            href: "/wallet",
            icon: <Wallet className="w-6 h-6 text-indigo-600" />,
            status: "active"
        },
        {
            label: wallet ? wallet.points_balance.toLocaleString() : (isLoading ? "..." : "0"),
            subLabel: "Point",
            href: "/points",
            icon: <Coins className="w-6 h-6 text-yellow-500" />
        },
        {
            label: "0",
            subLabel: "Voucher",
            href: "/voucher",
            icon: <Ticket className="w-6 h-6 text-orange-500" />
        },
    ]
    return (
        <div className="w-full font-sans">
            <div className="px-3 pt-3 pb-0">
                {/* Main Wallet Card */}
                <div className="bg-white w-full h-20 rounded-xl mt-10 border border-gray-100 overflow-hidden">
                    <div className="flex items-center mt-4 divide-x divide-gray-100">
                        {/* Scan/QR Section */}
                        <motion.div
                            whileTap={{ scale: 0.95 }}
                            className="p-4 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                            <ScanLine className="w-6 h-6 text-gray-700" />
                        </motion.div>

                        {/* Wallet Info Sections */}
                        <div className="flex-1 flex justify-between items-center py-4">
                            {WALLET_ITEMS.map((item, index) => (
                                <Link
                                    key={index}
                                    href={item.href}
                                    className="flex-1 flex items-center gap-3 px-4 border-r last:border-r-0 border-gray-50 hover:bg-gray-50 transition-colors"
                                >
                                    {/* Icon */}
                                    <div className="shrink-0">
                                        {item.icon}
                                    </div>

                                    {/* Text Container */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[13px] font-bold text-gray-800 leading-none">
                                            {item.label}
                                        </span>
                                        <span
                                            className={`text-[10px] leading-none ${item.status === "active"
                                                ? "text-gray-400 font-medium"
                                                : "text-gray-400"
                                                }`}
                                        >
                                            {item.subLabel}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}