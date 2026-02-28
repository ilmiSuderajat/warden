"use client"

import { useRouter } from "next/navigation"
import {
    ArrowLeft, MessageCircle, Phone, Mail,
    HelpCircle, ChevronRight, Zap, ShieldCheck,
    Headphones, ExternalLink
} from "lucide-react"

export default function ChatSupportPage() {
    const router = useRouter()

    const supportChannels = [
        {
            title: "WhatsApp",
            description: "Respon cepat (08:00 - 21:00)",
            icon: MessageCircle,
            color: "text-emerald-500",
            bg: "bg-emerald-50",
            action: () => window.open("https://wa.me/6281234567890?text=Halo%20Warden%20Support,%20saya%20butuh%20bantuan.")
        },
        {
            title: "Panggilan Suara",
            description: "Bicara langsung dengan kami",
            icon: Phone,
            color: "text-blue-500",
            bg: "bg-blue-50",
            action: () => window.open("tel:+6281234567890")
        },
        {
            title: "Email Support",
            description: "Untuk pertanyaan non-mendesak",
            icon: Mail,
            color: "text-indigo-500",
            bg: "bg-indigo-50",
            action: () => window.open("mailto:support@warden.id")
        }
    ]

    const faqs = [
        "Bagaimana cara melacak pesanan saya?",
        "Apakah bisa bayar di tempat (COD)?",
        "Bagaimana kebijakan pengembalian barang?",
        "Kenapa pembayaran saya gagal?"
    ]

    return (
        <div className="min-h-screen bg-slate-50/50 font-sans max-w-md mx-auto pb-24 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl -z-10"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50/50 rounded-full -ml-32 -mb-32 blur-3xl -z-10"></div>

            {/* HEADER */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center gap-3 px-5 pt-12 pb-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        <ArrowLeft size={20} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Pusat Bantuan</h1>
                </div>
            </div>

            <div className="p-5">
                {/* HERO SECTION */}
                <div className="bg-slate-900 rounded-3xl p-6 mb-8 relative overflow-hidden shadow-xl shadow-slate-200">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                                <Headphones className="text-white" size={24} />
                            </div>
                            <div>
                                <h2 className="text-white font-bold">Halo, ada yang bisa bantu?</h2>
                                <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Customer Service Aktif</p>
                            </div>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">
                            Punya kendala dengan pesanan atau produk? Jangan sungkan untuk menghubungi tim kami.
                        </p>
                    </div>
                    {/* Decorative shimmer */}
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>
                </div>

                {/* SUPPORT CHANNELS */}
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 mb-4">Hubungi Kami</h3>
                <div className="space-y-3 mb-8">
                    {supportChannels.map((channel, i) => (
                        <button
                            key={i}
                            onClick={channel.action}
                            className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all hover:border-indigo-100 group"
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${channel.bg}`}>
                                <channel.icon size={22} className={channel.color} />
                            </div>
                            <div className="flex-1 text-left">
                                <h4 className="text-sm font-bold text-slate-800">{channel.title}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">{channel.description}</p>
                            </div>
                            <ExternalLink size={16} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
                        </button>
                    ))}
                </div>

                {/* FAQ SECTION */}
                <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pertanyaan Populer</h3>
                    <button className="text-[10px] font-bold text-indigo-600">Lihat Semua</button>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                    {faqs.map((faq, i) => (
                        <button
                            key={i}
                            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
                        >
                            <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900">{faq}</span>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400" />
                        </button>
                    ))}
                </div>

                {/* TRUST BADGE */}
                <div className="mt-8 flex items-center justify-center gap-6 py-6 border-t border-slate-100">
                    <div className="flex flex-col items-center gap-1 opacity-40">
                        <ShieldCheck size={20} className="text-slate-500" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter">Aman & Terpercaya</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-40">
                        <Zap size={20} className="text-slate-500" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter">Respon Cepat</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
