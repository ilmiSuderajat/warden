"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"

export default function VoucherBanner() {
    return (
        <section className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50 bg-orange-50/30">
                <h2 className="text-indigo-600 font-extrabold text-sm tracking-tight flex items-center gap-1.5 uppercase">
                    VOUCHER
                </h2>
                <Link 
                    href="/voucher" 
                    className="text-gray-400 hover:text-indigo-500 transition-colors"
                >
                    <ChevronRight size={18} />
                </Link>
            </div>

            {/* Content - 2 Voucher Cards */}
            <div className="p-3 flex flex-col gap-3 flex-1">
                <div className="relative flex items-center bg-indigo-50/50 rounded-xl overflow-hidden border border-dashed border-indigo-200 p-2 group hover:bg-indigo-100 transition-colors">
                    <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg">
                        <span className="text-[10px] font-black italic">50%</span>
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                        <p className="text-[10px] font-black text-gray-800 uppercase leading-none">Diskon Kilat</p>
                        <p className="text-[8px] text-indigo-600 font-bold mt-0.5">Min. Belanja Rp0</p>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-600/20" />
                </div>

                <div className="relative flex items-center bg-orange-50/50 rounded-xl overflow-hidden border border-dashed border-orange-200 p-2 group hover:bg-orange-100 transition-colors">
                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg">
                        <span className="text-[10px] font-black italic">FREE</span>
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                        <p className="text-[10px] font-black text-gray-800 uppercase leading-none">Gratis Ongkir</p>
                        <p className="text-[8px] text-orange-600 font-bold mt-0.5">Semua Toko</p>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-orange-500/20" />
                </div>
            </div>
        </section>
    )
}
