"use client";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center font-sans">
      <div className="bg-red-50 p-6 rounded-[2.5rem] mb-6">
        <WifiOff size={48} className="text-red-500" />
      </div>
      <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Sinyal Ilang, Lur!</h1>
      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
        Coba cek kuota atau Wi-Fi kamu dulu, Warden butuh internet buat narik data Donsu.
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="mt-8 flex items-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
      >
        <RefreshCw size={14} /> Coba Lagi
      </button>
    </div>
  );
}