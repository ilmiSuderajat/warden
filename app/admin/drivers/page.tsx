"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import {
    ArrowLeft, Plus, Search, Loader2,
    Power, ShieldCheck, MapPin, RefreshCw, UserPlus,
    Trash2, Bike, ChevronRight, X, User
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function DriversAdminPage() {
    const router = useRouter()
    const [drivers, setDrivers] = useState<any[]>([])
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [userSearch, setUserSearch] = useState("")
    const [showAddModal, setShowAddModal] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const fetchDrivers = async () => {
        setLoading(true)
        const { data } = await supabase
            .from("users")
            .select("id, full_name, email, is_online, is_auto_accept, last_lat, last_lng, created_at")
            .eq("role", "driver")
            .order("created_at", { ascending: false })
        setDrivers(data || [])
        setLoading(false)
    }

    const fetchAllUsers = async () => {
        const { data } = await supabase
            .from("users")
            .select("id, full_name, email, role")
            .neq("role", "driver")
            .order("full_name")
        setAllUsers(data || [])
    }

    useEffect(() => { fetchDrivers() }, [])

    const handleAssignDriver = async (userId: string, name: string) => {
        setUpdatingId(userId)
        try {
            const res = await fetch("/api/admin/drivers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, action: "assign" })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            toast.success(`${name} berhasil ditambahkan sebagai Driver`)
            setShowAddModal(false)
            fetchDrivers()
        } catch (err: any) {
            toast.error(err.message || "Gagal menambahkan driver")
        } finally {
            setUpdatingId(null)
        }
    }

    const handleRevokeDriver = async (userId: string, name: string) => {
        if (!confirm(`Cabut akses driver dari ${name}?`)) return
        setUpdatingId(userId)
        try {
            const res = await fetch("/api/admin/drivers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, action: "revoke" })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            toast.success(`Akses driver ${name} berhasil dicabut`)
            fetchDrivers()
        } catch (err: any) {
            toast.error(err.message || "Gagal mencabut akses driver")
        } finally {
            setUpdatingId(null)
        }
    }

    const handleToggle = async (driverId: string, field: "is_online" | "is_auto_accept", currentVal: boolean) => {
        setUpdatingId(driverId)
        setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, [field]: !currentVal } : d))
        try {
            const res = await fetch("/api/admin/drivers", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: driverId, field, value: !currentVal })
            })
            if (!res.ok) throw new Error("Gagal memperbarui status")
        } catch {
            setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, [field]: currentVal } : d))
            toast.error("Gagal memperbarui status")
        } finally {
            setUpdatingId(null)
        }
    }

    const filteredDrivers = drivers.filter(d =>
        (d.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredUsers = allUsers.filter(u =>
        (u.full_name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(userSearch.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24 selection:bg-indigo-100">
            {/* HEADER */}
            <div className="bg-white sticky top-0 z-40 border-b border-slate-100/60 backdrop-blur-md bg-white/80">
                <div className="px-5 pt-12 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/admin')} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Manajemen Driver</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Armada Pengiriman</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchDrivers} disabled={loading} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all active:scale-95">
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={() => { fetchAllUsers(); setShowAddModal(true) }}
                            className="flex items-center gap-1.5 bg-indigo-600 text-white text-[10px] font-black px-3 py-2 rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-widest"
                        >
                            <Plus size={14} strokeWidth={3} /> Tambah
                        </button>
                    </div>
                </div>
                <div className="px-5 pb-5">
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                            <Search size={18} />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Cari armada driver..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all text-sm font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* LIST PREMIUM */}
            <div className="p-4 space-y-4">
                {loading ? (
                    [1,2,3].map(i => <div key={i} className="h-48 bg-white rounded-3xl border border-slate-100 animate-pulse" />)
                ) : filteredDrivers.length > 0 ? (
                    <div className="space-y-4 pb-12">
                         <div className="flex items-center gap-2 ml-1">
                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Armada Aktif</h3>
                        </div>
                        {filteredDrivers.map(driver => (
                            <div key={driver.id} className={`bg-white rounded-[2.5rem] border shadow-sm overflow-hidden p-6 space-y-5 transition-all group ${driver.is_online ? 'border-slate-100' : 'border-slate-200 opacity-80'}`}>
                                <div className="flex items-start justify-between relative">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-lg shrink-0 shadow-inner relative ${driver.is_online ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                                            {(driver.full_name || "D").charAt(0).toUpperCase()}
                                            {driver.is_online && <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-black text-slate-800 leading-tight truncate tracking-tight">{driver.full_name || "Tanpa Nama"}</h3>
                                            <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">{driver.email}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-sm ${driver.is_online ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                                                    {driver.is_online ? "Active Now" : "Offline"}
                                                </div>
                                                {driver.is_auto_accept && (
                                                    <div className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter bg-indigo-50 text-indigo-600 border border-indigo-100">Smart Accept</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRevokeDriver(driver.id, driver.full_name)}
                                        disabled={updatingId === driver.id}
                                        className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                        <Trash2 size={18} strokeWidth={2.5} />
                                    </button>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3 border border-slate-100 group-hover:bg-white transition-colors duration-500">
                                    <div className={`p-2 rounded-xl bg-white shadow-sm ${driver.last_lat ? "text-indigo-600" : "text-slate-300"}`}>
                                        <MapPin size={16} strokeWidth={2.5} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Positioning</p>
                                        <p className="text-[11px] font-bold text-slate-700 truncate italic">
                                            {driver.last_lat && driver.last_lng
                                                ? `${driver.last_lat.toFixed(6)}, ${driver.last_lng.toFixed(6)}`
                                                : "Radius tidak terdeteksi"}
                                        </p>
                                    </div>
                                    {driver.last_lat && <ChevronRight size={14} className="ml-auto text-slate-300" />}
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button onClick={() => handleToggle(driver.id, "is_online", driver.is_online)}
                                        disabled={updatingId === driver.id}
                                        className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${driver.is_online ? 'bg-emerald-50 text-emerald-700 border-emerald-100 ring-2 ring-emerald-50' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                        {updatingId === driver.id ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} strokeWidth={3} />}
                                        {driver.is_online ? "Set Offline" : "Go Online"}
                                    </button>
                                    <button onClick={() => handleToggle(driver.id, "is_auto_accept", driver.is_auto_accept)}
                                        disabled={updatingId === driver.id}
                                        className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${driver.is_auto_accept ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                        <ShieldCheck size={16} strokeWidth={3} />
                                        {driver.is_auto_accept ? "Strict Mode" : "Auto Accept"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-100 flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 text-slate-200">
                            <Bike size={40} />
                        </div>
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Armada Kosong</h4>
                        <p className="text-[10px] text-slate-400 font-medium px-14 leading-relaxed">Belum ada armada driver terdaftar. Klik tombol tambah untuk menunjuk personel.</p>
                    </div>
                )}
            </div>

            {/* ADD DRIVER MODAL - REDESIGN */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-t-[3rem] p-8 shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-500">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 tracking-tight">Angkat Driver</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assign Personel Armada</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-50 text-slate-400 rounded-2xl hover:text-slate-600 transition-all"><X size={20} strokeWidth={3} /></button>
                        </div>

                        <div className="relative group mb-6">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                <Search size={18} />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Cari nama atau email..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all text-sm font-bold"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
                            {filteredUsers.length > 0 ? filteredUsers.map(user => (
                                <div key={user.id} className="group bg-white border border-slate-50 hover:border-indigo-100 hover:shadow-md hover:shadow-slate-100 rounded-3xl p-4 flex items-center justify-between transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                            {(user.full_name || "U").charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-slate-800 truncate tracking-tight">{user.full_name || "Tanpa Nama"}</p>
                                            <p className="text-[10px] font-bold text-slate-400 truncate tracking-tight">{user.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAssignDriver(user.id, user.full_name)}
                                        disabled={updatingId === user.id}
                                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                        title="Jadikan Driver"
                                    >
                                        {updatingId === user.id ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} strokeWidth={3} />}
                                    </button>
                                </div>
                            )) : (
                                <div className="text-center py-12 flex flex-col items-center">
                                    <User size={32} className="text-slate-200 mb-2" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">User tidak ditemukan</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 pt-4 border-t border-slate-50">
                             <button onClick={() => setShowAddModal(false)}
                                className="w-full py-4 bg-slate-50 text-slate-400 font-black text-xs rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all uppercase tracking-widest border border-slate-100/50">
                                Tutup Panel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
