"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
    if (!confirm(`Hapus user "${name || 'ini'}" secara permanen? Data di public.users akan dihapus.`)) return;

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

  const handleUpdateGender = async (id: string, gender: string) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ gender })
        .eq("id", id);

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === id ? { ...u, gender } : u));
      toast.success("Gender diperbarui");
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui gender");
    }
  }

  const guessGender = (name: string): 'pria' | 'wanita' | null => {
    if (!name) return null;
    const n = name.toLowerCase();

    // Keywords for Female (Indonesian context)
    const femaleKeywords = [
      'wati', 'putri', 'sari', 'ani', 'ayu', 'lestari', 'uum', 'aminah', 'dinda',
      'khodijah', 'andini', 'seli', 'siti', 'nur', 'puji', 'endang', 'sri', 'dewi',
      'rini', 'ratna', 'lita', 'mia', 'ida', 'rahma', 'fitri', 'maya', 'neng',
      'ayu', 'indah', 'suci', 'kartika', 'mega', 'lia', 'vina', 'eka'
    ];

    // Keywords for Male (Indonesian context)
    const maleKeywords = [
      'budin', 'fajar', 'hapid', 'agus', 'budi', 'eko', 'putra', 'iwan', 'bambang',
      'slamet', 'mulyadi', 'joko', 'anton', 'andi', 'bayu', 'reza', 'dodi',
      'heri', 'rudi', 'yanto', 'ujang', 'asep', 'dede', 'cecep', 'adit', 'iqbal',
      'rifki', 'indra', 'surya', 'deni', 'hendra', 'tomi', 'bagus', 'ari'
    ];

    if (femaleKeywords.some(key => n.includes(key))) return 'wanita';
    if (maleKeywords.some(key => n.includes(key))) return 'pria';

    return null;
  }

  const handleAutoDetectAll = async () => {
    const updates = users
      .filter(u => !u.gender)
      .map(u => ({ id: u.id, gender: guessGender(u.full_name) }))
      .filter(u => u.gender !== null);

    if (updates.length === 0) {
      toast.info("Semua user sudah memiliki genre atau tidak terdeteksi");
      return;
    }

    setLoading(true);
    let successCount = 0;

    for (const update of updates) {
      const { error } = await supabase.from("users").update({ gender: update.gender }).eq("id", update.id);
      if (!error) successCount++;
    }

    await fetchUsers();
    toast.success(`${successCount} user berhasil diupdate otomatis!`);
    setLoading(false);
  }

  const getAvatarUrl = (user: any) => {
    if (user.avatar_url) return user.avatar_url;
    // Default avatar berdasarkan gender
    if (user.gender === 'pria') return `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name || user.id}&mood=happy`;
    if (user.gender === 'wanita') return `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name || user.id}&mood=happy&hairColor=black`;
    return null; // Pakai icon default
  }

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-24">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
              <Icons.ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Daftar Pelanggan</h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{users.length} Total Akun</p>
                <span className="text-slate-200">|</span>
                <button
                  onClick={handleAutoDetectAll}
                  className="text-[10px] font-bold text-indigo-600 uppercase hover:text-indigo-700 transition-colors flex items-center gap-1"
                >
                  <Icons.Sparkles size={10} />
                  Auto-Detect Genre
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="px-5 pb-4">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none text-gray-800 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* CUSTOMER LIST */}
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Icons.Loader2 className="animate-spin mb-2" size={24} />
            <p className="text-xs font-medium">Sinkronisasi data...</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div key={user.id} className={`bg-white p-5 rounded-2xl border transition-all shadow-sm flex flex-col gap-4 ${user.is_blocked ? 'border-red-100 opacity-80' : 'border-slate-100'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 overflow-hidden shrink-0 transition-colors ${user.is_blocked ? 'border-red-200' : 'border-slate-100'}`}>
                  {getAvatarUrl(user) ? (
                    <img src={getAvatarUrl(user)} alt={user.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${user.gender === 'wanita' ? 'bg-rose-50' : 'bg-indigo-50'}`}>
                      <Icons.User size={28} className={user.gender === 'wanita' ? 'text-rose-300' : 'text-indigo-300'} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-bold truncate ${user.is_blocked ? 'text-red-900' : 'text-slate-900'}`}>{user.full_name || "Tanpa Nama"}</h3>
                    {user.is_blocked && (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[8px] font-black uppercase tracking-tighter">Terblokir</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">{user.email}</p>

                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1">
                      <Icons.Calendar size={10} className="text-slate-400" />
                      <p className="text-[9px] text-slate-400 uppercase font-bold">{new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    {user.gender && (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase transition-colors ${user.gender === 'wanita' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                        {user.gender === 'wanita' ? <Icons.CircleDot size={8} /> : <Icons.Circle size={8} />}
                        {user.gender}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50">
                {/* Gender Toggle */}
                <select
                  value={user.gender || ""}
                  onChange={(e) => handleUpdateGender(user.id, e.target.value)}
                  className="bg-slate-50 text-[10px] font-bold text-slate-600 px-2 py-2 rounded-xl outline-none border border-transparent focus:border-indigo-100 transition-all cursor-pointer"
                >
                  <option value="">Set Genre</option>
                  <option value="pria">♂ Pria</option>
                  <option value="wanita">♀ Wanita</option>
                </select>

                {/* Block Button */}
                <button
                  onClick={() => handleToggleBlock(user.id, user.is_blocked)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition-all ${user.is_blocked ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
                >
                  {user.is_blocked ? <Icons.Unlock size={12} /> : <Icons.ShieldOff size={12} />}
                  {user.is_blocked ? "Buka" : "Blokir"}
                </button>

                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteUser(user.id, user.full_name)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-all text-[10px] font-bold"
                >
                  <Icons.Trash2 size={12} />
                  Hapus
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <Icons.Users className="mx-auto text-slate-200 mb-2" size={40} />
            <p className="text-xs text-slate-400">Tidak ada pelanggan ditemukan.</p>
          </div>
        )}
      </div>

      {/* FOOTER VERSION */}
      <div className="mt-8 text-center opacity-30">
        <p className="text-[9px] font-bold uppercase tracking-[0.3em]">Admin Panel v1.0.4</p>
      </div>
    </div>
  )
}
