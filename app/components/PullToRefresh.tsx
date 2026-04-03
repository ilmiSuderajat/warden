"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

interface PullToRefreshProps {
  children: React.ReactNode;
}

export default function PullToRefresh({ children }: PullToRefreshProps) {
  const router = useRouter();
  const [pullDist, setPullDist] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const threshold = 100; // Jarak tarik untuk memicu refresh

  const handleTouchStart = (e: TouchEvent) => {
    // Hanya aktif jika scroll bar berada di paling atas
    if (window.scrollY === 0) {
      startY.current = e.touches[0].pageY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    const currentY = e.touches[0].pageY;
    const diff = currentY - startY.current;

    if (diff > 0 && window.scrollY === 0) {
      // Menambahkan resistensi (r) pada tarikan
      const r = 0.4;
      const pull = Math.min(diff * r, threshold + 20);
      setPullDist(pull);

      // Prevent default browser behavior (seperti bounce ios / refresh bawaan jika perlu)
      if (diff > 10 && e.cancelable) {
        // e.preventDefault(); 
      }
    } else {
      setIsPulling(false);
      setPullDist(0);
    }
  }, [isPulling, isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling) return;

    if (pullDist >= threshold) {
      handleRefresh();
    } else {
      setPullDist(0);
    }
    setIsPulling(false);
  }, [isPulling, pullDist]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setPullDist(threshold);

    // Memberikan feedback visual sebentar sebelum reload
    setTimeout(() => {
      // Menggunakan router.refresh() untuk Next.js (hanya merefresh data server)
      // Atau window.location.reload() untuk full refresh.
      // Kita gunakan full reload agar semua state aplikasi ter-reset bersih
       window.location.reload();
    }, 800);
  };

  useEffect(() => {
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchMove, handleTouchEnd]);

  return (
    <div className="relative">
      {/* PTR INDICATOR */}
      <div 
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-[1000]"
        style={{ 
          height: `${pullDist}px`, 
          top: 0,
          opacity: pullDist / threshold,
          transition: isPulling ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease'
        }}
      >
        <div className={`p-2.5 rounded-full bg-white shadow-xl border border-slate-100 flex items-center justify-center transition-transform ${isRefreshing ? 'animate-spin' : ''}`}>
           {isRefreshing ? (
             <RefreshCw size={18} className="text-indigo-600" />
           ) : (
             <Zap 
               size={18} 
               className={pullDist >= threshold ? "text-orange-500 fill-orange-500 transition-colors" : "text-slate-300 transition-colors"} 
               strokeWidth={3}
             />
           )}
        </div>
      </div>

      {/* WRAPPED CONTENT */}
      <div 
        style={{ 
           transform: `translateY(${pullDist}px)`,
           transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {children}
      </div>
    </div>
  );
}
