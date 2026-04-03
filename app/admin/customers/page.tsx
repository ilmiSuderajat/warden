"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Search, Loader2, User, UserX, ShieldCheck, ShieldAlert, Trash2, Calendar, CircleDot, Circle, Sparkles, ChevronRight, MoreVertical } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Skeleton from "@/app/components/Skeleton"

export default function AdminCustomersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error("Error fetching users:", err)
      toast.error("Gagal memuat data pelanggan")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Hapus user "${name || 'ini'}" secara permanen? Semua data terkait akan terhapus.`)) return;

    try {
      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) throw error;

      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success("User berhasil dihapus");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus user");
    }
  }

  const handleToggleBlock = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_blocked: newStatus })
        .eq("id", id);

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_blocked: newStatus } : u));
      toast.success(newStatus ? "User telah diblokir" : "Blokir user dibuka");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengubah status blokir");
    }
  }

  const handleUpdateRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Ubah role user ini menjadi ${newRole.toUpperCase()}?`)) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", id);

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
      toast.success(`Role diperbarui ke ${newRole}`);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui role");
    }
  }

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getAvatarUrl = (user: any) => {
    if (user.avatar_url) return user.avatar_url;
    const seed = user.full_name || user.id || "default";
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&mood=happy`;
  }

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
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">User & Admin</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database Pengguna</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg border border-slate-200">
               {users.length} TOTAL
            </span>
          </div>
        </div>

        {/* SEARCH BAR REDESIGN */}
        <div className="px-5 pb-5">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Cari nama, email, atau ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all text-sm font-medium"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          [1,2,3,4].map(i => <div key={i} className="h-44 bg-white rounded-3xl border border-slate-100 animate-pulse" />)
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto text-slate-300"><User size={32} /></div>
            <p className="text-sm font-bold text-slate-400 tracking-tight">Tidak ada pengguna ditemukan</p>
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div key={u.id} className={`bg-white rounded-3xl border shadow-sm p-5 space-y-5 hover:border-indigo-100 transition-all group overflow-hidden relative ${u.is_blocked ? 'bg-red-50/20 border-red-100' : 'border-slate-50'}`}>
              
              {/* Background Accent for Role */}
              <div className={`absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl opacity-10 ${u.role === 'admin' ? 'bg-indigo-600' : 'bg-slate-400'}`} />

              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full p-1 border-2 shrink-0 ${u.role === 'admin' ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100 bg-slate-50'} ${u.is_blocked ? 'border-red-200 grayscale' : ''}`}>
                    <img src={getAvatarUrl(u)} className="w-full h-full object-cover rounded-full" alt={u.full_name} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={`text-sm font-black truncate tracking-tight ${u.is_blocked ? 'text-red-900' : 'text-slate-900'}`}>{u.full_name || "Tanpa Nama"}</h3>
                      {u.role === 'admin' && (
                        <div className="px-1.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[7px] font-black uppercase tracking-widest shadow-sm shadow-indigo-200">ADMIN</div>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 truncate max-w-[180px]">{u.email || 'Email tidak disetel'}</p>
                    <div className="flex items-center gap-2 mt-2">
                       <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                          <Calendar size={10} /> {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                       </div>
                       {u.gender && (
                         <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${u.gender === 'wanita' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                           {u.gender}
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  {u.is_blocked ? (
                    <span className="ml-auto px-2 py-1 bg-red-100 text-red-600 text-[8px] font-black rounded-lg uppercase tracking-tight">Banned</span>
                  ) : (
                    <span className="ml-auto px-2 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black rounded-lg uppercase tracking-tight">Active</span>
                  )}
                </div>
              </div>

              {/* ACTION GRID */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50 relative z-10">
                <button 
                  onClick={() => handleUpdateRole(u.id, u.role)}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all active:scale-95 border ${u.role === 'admin' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                >
                  <ShieldCheck size={18} strokeWidth={2.5} />
                  <span className="text-[9px] font-black uppercase">Role {u.role === 'admin' ? 'User' : 'Admin'}</span>
                </button>

                <button 
                  onClick={() => handleToggleBlock(u.id, u.is_blocked)}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all active:scale-95 border ${u.is_blocked ? 'bg-yellow-50 border-yellow-100 text-yellow-600' : 'bg-red-50 border-red-100 text-red-600'}`}
                >
                  {u.is_blocked ? <ShieldCheck size={18} strokeWidth={2.5} /> : <ShieldAlert size={18} strokeWidth={2.5} />}
                  <span className="text-[9px] font-black uppercase">{u.is_blocked ? 'Unblock' : 'Block'}</span>
                </button>

                <button 
                  onClick={() => handleDeleteUser(u.id, u.full_name)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95"
                >
                  <Trash2 size={18} strokeWidth={2.5} />
                  <span className="text-[9px] font-black uppercase">Delete</span>
                </button>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  )
}
