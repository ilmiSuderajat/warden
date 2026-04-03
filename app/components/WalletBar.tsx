"use client"
import { motion } from "framer-motion"
import Link from "next/link"
import { ScanLine, Wallet, Coins, Ticket } from "lucide-react"

const WALLET_ITEMS = [
  {
    label: "Rp 0",
    subLabel: "Aktifkan",
    href: "/wallet",
    icon: <Wallet className="w-5 h-5 text-orange-600" />,
    status: "active"
  },
  {
    label: "0",
    subLabel: "Point",
    href: "/points",
    icon: <Coins className="w-5 h-5 text-yellow-500" />
  },
  {
    label: "0",
    subLabel: "Voucher",
    href: "/voucher",
    icon: <Ticket className="w-5 h-5 text-orange-500" />
  },
];

export default function WalletBar() {
  return (
    <div className="mx-3 mt-16 mb-4">
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="flex items-center divide-x divide-gray-50">

          {/* Scan/QR Section */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            className="p-4 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <ScanLine className="w-6 h-6 text-slate-700" />
          </motion.div>

          {/* Wallet Info Sections */}
          <div className="flex-1 flex justify-between items-center py-4">
            {WALLET_ITEMS.map((item, index) => (
              <Link
                key={index}
                href={item.href}
                className="flex-1 flex items-center gap-2.5 px-3 border-r last:border-r-0 border-gray-50 group"
              >
                <div className="shrink-0 transition-transform group-active:scale-90">
                  {item.icon}
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-[12px] font-black text-slate-800 leading-none">
                    {item.label}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-tight leading-none ${item.status === 'active' ? 'text-orange-500' : 'text-slate-400'}`}>
                    {item.subLabel}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
