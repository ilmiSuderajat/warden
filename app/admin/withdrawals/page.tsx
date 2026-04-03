"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Inbox, Loader2, X, Check, Wallet, History, CreditCard, User, Store, Bike, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Skeleton from "@/app/components/Skeleton"

type WithdrawRequest = {
  id: string
  amount: number
  bank_name: string
  account_number: string
  account_name: string
  status: "pending" | "approved" | "rejected"
  created_at: string
  type: "driver" | "shop" | "user"
  owner_name: string
  target_id: string
}

export default function AdminWithdrawalsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"driver" | "shop" | "user">("driver")
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<WithdrawRequest[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch independently to handle missing tables gracefully
      const [userRes, driverRes, shopRes] = await Promise.all([
        supabase.from("user_withdraw_requests").select("*, users(full_name)").eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("driver_withdraw_requests").select("*, users(full_name)").eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("shop_withdraw_requests").select("*, shops(name)").eq("status", "pending").order("created_at", { ascending: false })
      ])

      if (userRes.error && userRes.error.code !== 'PGRST116') console.warn("User withdrawal table error:", userRes.error)
      if (driverRes.error && driverRes.error.code !== 'PGRST116') console.warn("Driver withdrawal table error:", driverRes.error)
      if (shopRes.error && shopRes.error.code !== 'PGRST116') console.warn("Shop withdrawal table error:", shopRes.error)

      const userReqs = userRes.data || []
      const driverReqs = driverRes.data || []
      const shopReqs = shopRes.data || []

      const combined: WithdrawRequest[] = [
        ...userReqs.map((r: any) => ({ ...r, type: "user", owner_name: r.users?.full_name || "Unknown", target_id: r.user_id })),
        ...driverReqs.map((r: any) => ({ ...r, type: "driver", owner_name: r.users?.full_name || "Unknown", target_id: r.driver_id })),
        ...shopReqs.map((r: any) => ({ ...r, type: "shop", owner_name: r.shops?.name || "Unknown", target_id: r.shop_id })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setRequests(combined)
    } catch (err) {
      console.error("Fetch error:", err)
      toast.error("Gagal memuat data penarikan")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAction = async (id: string, type: string, targetId: string, action: "approve" | "reject", amount: number) => {
    if (!confirm(`Apakah Anda yakin ingin ${action === "approve" ? "MENYETUJUI" : "MENOLAK"} penarikan ini?`)) return
    
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/withdrawals/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type, targetId, amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast.success(action === "approve" ? "Penarikan Dana Disetujui" : "Penarikan Dana Ditolak")
      fetchData()
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses penarikan")
    } finally {
      setActionLoading(null)
    }
  }

  const formatRp = (v: number) => `Rp ${v.toLocaleString("id-ID")}`
  const formatDate = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

  const filtered = requests.filter(r => r.type === activeTab)

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto relative pb-24 selection:bg-indigo-100">
      
      {/* HEADER PREMIUM GLASS */}
      <div className="bg-white/80 sticky top-0 z-40 border-b border-slate-100/60 backdrop-blur-md">
        <div className="px-5 pt-12 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <button onClick={() => router.push('/admin')} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                <ArrowLeft size={20} strokeWidth={2.5} />
              </button>
              <div>
                <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Withdrawal</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pencairan Dana</p>
              </div>
          </div>
          <History size={20} className="text-slate-300" />
        </div>
        
        {/* TAB SWITCHER PREMIUM */}
        <div className="flex px-4 pb-4 gap-2">
          {[
            { id: "driver", label: "Driver", icon: <Bike size={14} /> },
            { id: "shop", label: "Warung", icon: <Store size={14} /> },
            { id: "user", label: "User", icon: <User size={14} /> }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
                activeTab === t.id 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-[1.02]" 
                  : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
              }`}
            >
              {t.icon}
              {t.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {requests.filter(r => r.type === t.id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 space-y-4 shadow-sm animate-pulse">
                <div className="flex justify-between">
                    <div className="space-y-2">
                        <div className="h-3 w-20 bg-slate-100 rounded-full" />
                        <div className="h-6 w-32 bg-slate-100 rounded-full" />
                    </div>
                    <div className="h-6 w-16 bg-slate-100 rounded-full" />
                </div>
                <div className="h-20 w-full bg-slate-50 rounded-2xl" />
                <div className="flex gap-3">
                    <div className="h-12 flex-1 bg-slate-100 rounded-2xl" />
                    <div className="h-12 flex-1 bg-slate-100 rounded-2xl" />
                </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-100 flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 text-slate-200">
              <Inbox size={40} />
            </div>
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Antrian Kosong</h4>
            <p className="text-[10px] text-slate-400 font-medium px-14 leading-relaxed tracking-tight text-center">Tidak ada permintaan pencairan dana yang tertunda untuk kategori ini.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-12">
            <div className="flex items-center gap-2 ml-1">
                <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Verification</h3>
            </div>
            {filtered.map((req) => (
                <div key={req.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:border-indigo-100 transition-all duration-300">
                    
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-50/50 to-transparent -z-0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="relative z-10 flex flex-col gap-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                    {req.owner_name}
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xs font-black text-slate-400">Rp</span>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{req.amount.toLocaleString("id-ID")}</h3>
                                </div>
                            </div>
                            <div className="bg-amber-50 text-amber-600 text-[8px] font-black px-2.5 py-1.5 rounded-xl border border-amber-100 flex items-center gap-2 uppercase tracking-widest shadow-sm shadow-amber-50">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                                Pending
                            </div>
                        </div>

                        {/* BANK CARD LOOK */}
                        <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-3xl space-y-4 hover:bg-white transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm"><CreditCard size={16} strokeWidth={2.5} /></div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Institution</p>
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{req.bank_name}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100/50 flex justify-between items-end">
                                <div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Account Holder</p>
                                    <p className="text-[11px] font-extrabold text-slate-700 tracking-tight">{req.account_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Number</p>
                                    <p className="text-[11px] font-black text-indigo-600 font-mono tracking-widest">{req.account_number}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleAction(req.id, req.type, req.target_id, "reject", req.amount)}
                                disabled={!!actionLoading}
                                className="flex-1 bg-white border border-red-100 text-red-500 font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {actionLoading === req.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} strokeWidth={3} />}
                                Reject
                            </button>
                            <button
                                onClick={() => handleAction(req.id, req.type, req.target_id, "approve", req.amount)}
                                disabled={!!actionLoading}
                                className="flex-1 bg-indigo-600 text-white font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {actionLoading === req.id ? <Loader2 size={14} className="animate-spin text-white" /> : <Check size={14} strokeWidth={3} />}
                                Approve
                            </button>
                        </div>

                        <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                            <span>Req ID: #{req.id.slice(0,8).toUpperCase()}</span>
                            <span>{formatDate(req.created_at)}</span>
                        </div>
                    </div>
                </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
