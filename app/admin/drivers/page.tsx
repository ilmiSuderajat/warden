"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import {
    ArrowLeft, Plus, Search, Loader2,
    Power, ShieldCheck, MapPin, RefreshCw, UserPlus,
    Trash2, Bike
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

    // Call server API to assign driver role (bypasses RLS with service role key)
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
        // Optimistic UI update
        setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, [field]: !currentVal } : d))
        try {
            const res = await fetch("/api/admin/drivers", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: driverId, field, value: !currentVal })
            })
            if (!res.ok) throw new Error("Gagal memperbarui status")
        } catch {
            // Revert on error
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
        <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-24">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-5 pt-12 pb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Manajemen Driver</h1>
                            <p className="text-[10px] text-slate-400 font-medium">{drivers.length} driver terdaftar</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchDrivers} disabled={loading} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors">
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={() => { fetchAllUsers(); setShowAddModal(true) }}
                            className="flex items-center gap-2 bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-emerald-600 transition-colors"
                        >
                            <UserPlus size={16} /> Tambah
                        </button>
                    </div>
                </div>
                <div className="px-5 pb-4">
                    <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5">
                        <Search size={16} className="text-slate-400" />
                        <input type="text" placeholder="Cari nama atau email driver..."
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                    </div>
                </div>
            </div>

            {/* LIST */}
            <div className="p-5">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-3 text-emerald-500" size={24} />
                        <p className="text-xs font-medium">Memuat data driver...</p>
                    </div>
                ) : filteredDrivers.length > 0 ? (
                    <div className="space-y-4">
                        {filteredDrivers.map(driver => (
                            <div key={driver.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-base shrink-0 ${driver.is_online ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                {(driver.full_name || "D").charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900 leading-tight">{driver.full_name || "Tanpa Nama"}</h3>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{driver.email}</p>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${driver.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                                    <span className={`text-[10px] font-bold ${driver.is_online ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {driver.is_online ? "Online" : "Offline"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => handleRevokeDriver(driver.id, driver.full_name)}
                                            disabled={updatingId === driver.id}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 mb-4">
                                        <MapPin size={12} className={driver.last_lat ? "text-indigo-500" : "text-slate-300"} />
                                        <span className="text-[10px] font-medium text-slate-500">
                                            {driver.last_lat && driver.last_lng
                                                ? `GPS: ${driver.last_lat.toFixed(4)}, ${driver.last_lng.toFixed(4)}`
                                                : "GPS belum tersedia"}
                                        </span>
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => handleToggle(driver.id, "is_online", driver.is_online)}
                                            disabled={updatingId === driver.id}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${driver.is_online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                            {updatingId === driver.id ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} strokeWidth={2.5} />}
                                            {driver.is_online ? "Online" : "Offline"}
                                        </button>
                                        <button onClick={() => handleToggle(driver.id, "is_auto_accept", driver.is_auto_accept)}
                                            disabled={updatingId === driver.id}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${driver.is_auto_accept ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                            <ShieldCheck size={13} strokeWidth={2.5} />
                                            {driver.is_auto_accept ? "Auto-Terima" : "Auto-OFF"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                            <Bike size={32} />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">Tidak ada driver</p>
                        <p className="text-xs text-slate-400 mt-1">Tekan "Tambah" untuk menetapkan driver.</p>
                    </div>
                )}
            </div>

            {/* ADD DRIVER MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl">
                        <h2 className="text-base font-bold text-slate-900 mb-1">Tambah Driver Baru</h2>
                        <p className="text-xs text-slate-400 mb-5">Pilih pengguna yang akan diangkat sebagai driver.</p>

                        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 mb-4">
                            <Search size={14} className="text-slate-400" />
                            <input type="text" placeholder="Cari user..." value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" autoFocus />
                        </div>

                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {filteredUsers.length > 0 ? filteredUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{user.full_name || "Tanpa Nama"}</p>
                                        <p className="text-[10px] text-slate-400">{user.email}</p>
                                        {user.role && user.role !== 'customer' && (
                                            <span className="text-[9px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{user.role}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleAssignDriver(user.id, user.full_name)}
                                        disabled={updatingId === user.id}
                                        className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                    >
                                        {updatingId === user.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                        Jadikan Driver
                                    </button>
                                </div>
                            )) : (
                                <p className="text-center text-xs text-slate-400 py-8">Tidak ada user ditemukan.</p>
                            )}
                        </div>

                        <button onClick={() => setShowAddModal(false)}
                            className="mt-5 w-full py-3 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors">
                            Batal
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
