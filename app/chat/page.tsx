"use client"

import { useState } from 'react'
import { Search, ChevronDown, MessageCircle, Mail, FileText, HelpCircle, Clock, ArrowRight, ArrowLeft, MessageSquare, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

const faqData = [
    {
        question: "Bagaimana cara melacak pesanan saya?",
        answer: "Buka menu Profil > Pesanan Saya. Pilih pesanan yang ingin Anda lacak untuk melihat status pengiriman real-time dari kurir kami."
    },
    {
        question: "Apakah bisa COD (Bayar di Tempat)?",
        answer: "Ya, kami mendukung pembayaran COD untuk wilayah tertentu. Pilih metode pembayaran 'Bayar di Tempat' saat checkout jika tersedia."
    },
    {
        question: "Bagaimana jika barang yang diterima rusak?",
        answer: "Jangan khawatir! Anda bisa mengajukan komplain lewat chat admin atau menu bantuan dalam 1x24 jam setelah barang diterima dengan melampirkan video unboxing."
    },
    {
        question: "Berapa lama ongkir ke lokasi saya?",
        answer: "Waktu pengiriman bergantung pada jarak toko ke lokasi Anda. Biasanya berkisar antara 30-90 menit untuk pengiriman instan."
    },
    {
        question: "Bagaimana cara menggunakan voucher diskon?",
        answer: "Masukkan kode voucher di kolom 'Punya kode promo?' pada halaman Checkout sebelum menekan tombol Bayar Sekarang."
    }
]

const quickLinks = [
    { icon: FileText, label: "Panduan", count: 12 },
    { icon: HelpCircle, label: "FAQ Dasar", count: 48 },
    { icon: Clock, label: "Sistem", status: "Aktif" }
]

export default function ChatPage() {
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")
    const [openFaq, setOpenFaq] = useState<number | null>(null)

    const filteredFaq = faqData.filter(item =>
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const openLiveChat = () => {
        router.push('/chat/live')
    }

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans text-slate-900 pb-20">
            {/* --- HEADER FIXED --- */}
            <header className="fixed max-w-md mx-auto top-0 left-0 right-0 z-50 flex justify-center bg-white">
                <div className="w-full max-w-md h-14 flex items-center px-4 border-b border-slate-100">
                    <button
                        onClick={() => router.back()}
                        className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform touch-manipulation"
                    >
                        <ArrowLeft size={24} strokeWidth={2.5} />
                    </button>
                    <h1 className="ml-3 text-lg font-bold tracking-tight">Pusat Bantuan</h1>
                </div>
            </header>

            {/* --- CONTENT --- */}
            <main className="pt-14 px-5">
                {/* Hero Section */}
                <div className="py-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-100 mb-5">
                        <MessageSquare className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Halo, ada yang bisa kami bantu?</h2>
                    <p className="text-sm text-slate-500 max-w-[280px] mx-auto">Cari jawaban dari FAQ kami atau hubungi tim support Warden.</p>
                </div>

                {/* Search Bar */}
                <div className="relative mb-8 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Cari topik bantuan..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-sm"
                    />
                </div>

                {/* Quick Stats/Links */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                    {quickLinks.map((link, index) => (
                        <div
                            key={index}
                            className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-xs"
                        >
                            <link.icon className="w-5 h-5 text-indigo-600 mx-auto mb-2" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{link.label}</p>
                            {link.count && <p className="text-xs font-bold text-slate-800">{link.count}</p>}
                            {link.status && (
                                <span className="flex items-center justify-center gap-1 text-[10px] text-emerald-600 font-bold uppercase">
                                    <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                                    {link.status}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* FAQ Section */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">Pertanyaan Populer</h3>
                    <div className="space-y-3">
                        {filteredFaq.length > 0 ? (
                            filteredFaq.map((item, index) => (
                                <div key={index} className="bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all shadow-xs">
                                    <button
                                        onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                        className="w-full px-5 py-4 flex items-center justify-between text-left active:bg-slate-50 transition-colors"
                                    >
                                        <span className="text-sm font-bold text-slate-700 leading-snug">{item.question}</span>
                                        <ChevronDown
                                            className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${openFaq === index ? 'rotate-180 text-indigo-600' : ''}`}
                                        />
                                    </button>
                                    <div
                                        className={`transition-all duration-300 ease-in-out ${openFaq === index ? 'max-h-40 py-4 pt-0' : 'max-h-0'}`}
                                    >
                                        <p className="px-5 text-[13px] text-slate-500 leading-relaxed border-t border-slate-50 pt-3">
                                            {item.answer}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-400 font-medium italic">Tidak ada pertanyaan yang sesuai</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Contact Options */}
                <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden mb-10">
                    <div className="relative z-10">
                        <h3 className="text-lg font-bold mb-1">Masih butuh bantuan?</h3>
                        <p className="text-indigo-100 text-[13px] mb-5 leading-relaxed opacity-90">Tim kami siap membantu Anda setiap hari pukul 08:00 - 22:00 WIB.</p>

                        <div className="grid gap-3">
                            <button
                                onClick={openLiveChat}
                                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl text-indigo-600 font-bold text-sm shadow-sm active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <MessageCircle size={20} />
                                    <span>Live Chat Sekarang</span>
                                </div>
                                <ArrowRight size={18} />
                            </button>

                            <a
                                href="mailto:support@warden.id"
                                className="w-full flex items-center justify-between p-4 bg-indigo-500/30 rounded-2xl text-white font-bold text-sm border border-indigo-400/30 active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <Mail size={20} />
                                    <span>Kirim Email</span>
                                </div>
                                <ExternalLink size={18} className="opacity-50" />
                            </a>
                        </div>
                    </div>
                    {/* Decorative Background Decor */}
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                </div>
            </main>
        </div>
    )
}