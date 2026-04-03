"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Plus, Store, Trash2, Pencil, Search, Loader2, MapPin, Phone, User, Check, X, Shield, Globe } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Skeleton from "@/app/components/Skeleton"

export default function ShopManagementPage() {
  const router = useRouter()
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingShop, setEditingShop] = useState<any>(null)

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    address: "",
    whatsapp: "",
    latitude: "",
    longitude: "",
    owner_id: "",
    cod_enabled: false
  })

  const fetchShops = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("shops")
      .select(`
        *,
        owner:users(full_name, email)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      toast.error("Gagal memuat list toko")
    } else {
      setShops(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchShops()
  }, [])

  const handleEdit = (shop: any) => {
    setEditingShop(shop)
    setFormData({
      name: shop.name || "",
      slug: shop.slug || "",
      address: shop.address || "",
      whatsapp: shop.whatsapp || "",
      latitude: shop.latitude?.toString() || "",
      longitude: shop.longitude?.toString() || "",
      owner_id: shop.owner_id || "",
      cod_enabled: shop.cod_enabled || false
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus toko ini? Semua data terkait mungkin akan berpengaruh.")) return
    
    const { error } = await supabase.from("shops").delete().eq("id", id)
    if (error) {
      toast.error("Gagal menghapus toko: " + error.message)
    } else {
      toast.success("Toko berhasil dihapus")
      setShops(prev => prev.filter(s => s.id !== id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      ...formData,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      slug: formData.slug || formData.name.toLowerCase().replace(/ /g, "-")
    }

    let error
    if (editingShop) {
      const { error: err } = await supabase.from("shops").update(payload).eq("id", editingShop.id)
      error = err
    } else {
      const { error: err } = await supabase.from("shops").insert([payload])
      error = err
    }

    if (error) {
      toast.error("Gagal menyimpan: " + error.message)
    } else {
      toast.success(editingShop ? "Toko diperbarui" : "Toko ditambahkan")
      setShowForm(false)
      setEditingShop(null)
      fetchShops()
    }
    setSaving(false)
  }

  const filteredShops = shops.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.owner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
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
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Owner & Warung</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Management Toko</p>
            </div>
          </div>
          <button 
            onClick={() => { setEditingShop(null); setFormData({ name: "", slug: "", address: "", whatsapp: "", latitude: "", longitude: "", owner_id: "", cod_enabled: false }); setShowForm(true); }}
            className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        
        {/* SEARCH */}
        {!showForm && (
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Cari toko atau nama owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all text-sm font-medium"
            />
          </div>
        )}

        {/* FORM MODAL STYLE */}
        {showForm && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">{editingShop ? "Edit Detail Toko" : "Daftarkan Toko Baru"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-lg"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Toko</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                  placeholder="Warung Berkah"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Owner User ID</label>
                  <input 
                    required
                    type="text" 
                    value={formData.owner_id}
                    onChange={e => setFormData({...formData, owner_id: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                    placeholder="UUID User"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                  <input 
                    type="text" 
                    value={formData.whatsapp}
                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                    placeholder="08123..."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Alamat Lengkap</label>
                <textarea 
                  rows={2}
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                  placeholder="Jl. Merdeka No. 1..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Latitude</label>
                  <input 
                    type="text" 
                    value={formData.latitude}
                    onChange={e => setFormData({...formData, latitude: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Longitude</label>
                  <input 
                    type="text" 
                    value={formData.longitude}
                    onChange={e => setFormData({...formData, longitude: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="cod"
                  checked={formData.cod_enabled}
                  onChange={e => setFormData({...formData, cod_enabled: e.target.checked})}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="cod" className="text-xs font-bold text-slate-600">Aktifkan COD untuk Toko ini</label>
              </div>

              <button 
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {saving ? "Menyimpan..." : "Simpan Data Toko"}
              </button>
            </form>
          </div>
        )}

        {/* SHOP LIST */}
        {!showForm && (
          <div className="space-y-3">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-40 bg-white rounded-3xl border border-slate-100 animate-pulse" />)
            ) : filteredShops.length === 0 ? (
              <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto text-slate-300"><Store size={32} /></div>
                <p className="text-sm font-bold text-slate-400">Belum ada toko yang terdaftar</p>
              </div>
            ) : (
              filteredShops.map((shop) => (
                <div key={shop.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4 hover:border-indigo-200 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner shrink-0">
                        {shop.image_url ? (
                          <img src={shop.image_url} className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <Store size={24} strokeWidth={2.5} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-800 tracking-tight truncate">{shop.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <User size={10} className="text-slate-400" />
                          <p className="text-[11px] font-bold text-slate-500 truncate">{shop.owner?.full_name || 'Tanpa Owner'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(shop)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(shop.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {shop.whatsapp && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                        <Phone size={10} /> {shop.whatsapp}
                      </div>
                    )}
                    {shop.cod_enabled && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold">
                        <Shield size={10} /> COD Aktif
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-full text-[10px] font-bold ml-auto">
                      <Globe size={10} /> Rp {shop.balance?.toLocaleString('id-ID') || 0}
                    </div>
                  </div>

                  {shop.address && (
                    <div className="p-3 bg-slate-50 rounded-2xl flex items-start gap-2 text-slate-500">
                      <MapPin size={14} className="shrink-0 mt-0.5" />
                      <p className="text-[10px] font-medium leading-relaxed italic">{shop.address}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  )
}
