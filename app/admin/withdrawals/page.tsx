"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
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
  const [activeTab, setActiveTab] = useState<"driver" | "shop" | "user">("driver")
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<WithdrawRequest[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch User Withdrawals
      const { data: userReqs } = await supabase
        .from("user_withdraw_requests")
        .select("*, users(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      // Fetch Driver Withdrawals
      const { data: driverReqs } = await supabase
        .from("driver_withdraw_requests")
        .select("*, users(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      // Fetch Shop Withdrawals
      const { data: shopReqs } = await supabase
        .from("shop_withdraw_requests")
        .select("*, shops(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      const combined: WithdrawRequest[] = [
        ...(userReqs || []).map((r: any) => ({ ...r, type: "user", owner_name: r.users?.full_name || "Unknown", target_id: r.user_id })),
        ...(driverReqs || []).map((r: any) => ({ ...r, type: "driver", owner_name: r.users?.full_name || "Unknown", target_id: r.driver_id })),
        ...(shopReqs || []).map((r: any) => ({ ...r, type: "shop", owner_name: r.shops?.name || "Unknown", target_id: r.shop_id })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setRequests(combined)
    } catch (err) {
      console.error(err)
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
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto relative pb-24">
      {/* HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-white">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4">
          <Link href="/admin">
            <Icons.ArrowLeft size={20} className="text-slate-400 hover:text-white transition-colors" />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Kelola Penarikan</h1>
            <p className="text-[10px] font-medium text-slate-400">Persetujuan Pencairan Dana</p>
          </div>
        </div>
        
        {/* TABS */}
        <div className="flex px-5 pb-4 gap-2">
          {["driver", "shop", "user"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t as any)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === t 
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" 
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {t === "driver" ? "Driver" : t === "shop" ? "Warung" : "User"}
              <span className="ml-1.5 opacity-70 font-normal">
                ({requests.filter(r => r.type === t).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-40" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <Icons.Inbox size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">Tidak ada pending request</p>
          </div>
        ) : (
          filtered.map((req) => (
            <div key={req.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-100 to-transparent -z-0"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{req.owner_name}</h3>
                    <p className="text-2xl font-black text-slate-900 leading-none">{formatRp(req.amount)}</p>
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                    Menunggu
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-5 border border-slate-100 bg-slate-50/50 p-3 rounded-xl">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Bank Tujuan</p>
                    <p className="text-xs font-bold text-slate-800">{req.bank_name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">No Rekening</p>
                    <p className="text-xs font-bold text-slate-800 font-mono tracking-wider">{req.account_number}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Atas Nama</p>
                    <p className="text-xs font-bold text-slate-800">{req.account_name}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction(req.id, req.type, req.target_id, "reject", req.amount)}
                    disabled={!!actionLoading}
                    className="flex-1 border border-red-200 bg-red-50 text-red-600 font-bold py-3 rounded-xl text-xs active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 hover:bg-red-100"
                  >
                    {actionLoading === req.id ? <Icons.Loader2 size={14} className="animate-spin" /> : <Icons.X size={14} />}
                    Tolak & Refund
                  </button>
                  <button
                    onClick={() => handleAction(req.id, req.type, req.target_id, "approve", req.amount)}
                    disabled={!!actionLoading}
                    className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs active:scale-95 transition-all shadow-md shadow-emerald-500/30 disabled:opacity-50 flex items-center justify-center gap-1.5 hover:bg-emerald-600"
                  >
                    {actionLoading === req.id ? <Icons.Loader2 size={14} className="animate-spin" /> : <Icons.Check size={14} />}
                    Setujui
                  </button>
                </div>
                
                <p className="text-[9px] text-slate-400 text-center mt-3">Diajukan pada: {formatDate(req.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
