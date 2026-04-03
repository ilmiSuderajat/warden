"use client"
import { motion } from "framer-motion"
import { Truck, ShieldCheck, Heart, Clock } from "lucide-react"

const BADGES = [
  { icon: Truck, label: "Gratis Ongkir", color: "text-emerald-500", bg: "bg-emerald-50" },
  { icon: ShieldCheck, label: "100% Produk Ori", color: "text-indigo-500", bg: "bg-indigo-50" },
  { icon: Heart, label: "Garansi Kepuasan", color: "text-rose-500", bg: "bg-rose-50" },
  { icon: Clock, label: "Pengiriman Kilat", color: "text-amber-500", bg: "bg-amber-50" },
]

export default function TrustBadges() {
  return (
    <section className="mx-4 mb-10 overflow-hidden px-1">
      <div className="grid grid-cols-4 gap-2">
        {BADGES.map((badge, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl ${badge.bg} border border-white/50 shadow-xs hover:shadow-md transition-shadow`}
          >
            <div className={`${badge.color}`}>
              <badge.icon size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[8px] font-black uppercase text-center leading-tight tracking-wider text-slate-700">
              {badge.label}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
