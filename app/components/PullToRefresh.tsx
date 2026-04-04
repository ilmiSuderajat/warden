"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface PullToRefreshProps {
  children: React.ReactNode;
}

export default function PullToRefresh({ children }: PullToRefreshProps) {
  const pathname = usePathname();
  const [pullDist, setPullDist] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const startY = useRef(0);
  const threshold = 100;

  // Disable PTR logic entirely for chat and specific full-screen pages
  const isDisabledPage = pathname?.startsWith('/chat') || pathname?.startsWith('/admin/chat') || pathname?.startsWith('/admin/shop-chat');

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0 && !isDisabledPage) {
      startY.current = e.touches[0].pageY;
      setIsPulling(true);
      setIsAnimating(true);
    }
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || isRefreshing || isDisabledPage) return;

    const currentY = e.touches[0].pageY;
    const diff = currentY - startY.current;

    if (diff > 0 && window.scrollY === 0) {
      const r = 0.4;
      const pull = Math.min(diff * r, threshold + 20);
      setPullDist(pull);
    } else {
      setIsPulling(false);
      setPullDist(0);
    }
  }, [isPulling, isRefreshing, isDisabledPage]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling || isDisabledPage) return;

    if (pullDist >= threshold) {
      handleRefresh();
    } else {
      setPullDist(0);
    }
    setIsPulling(false);
  }, [isPulling, pullDist, isDisabledPage]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setPullDist(threshold);

    setTimeout(() => {
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

  if (isDisabledPage) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
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

      <div 
        onTransitionEnd={() => {
          if (!isPulling && pullDist === 0 && !isRefreshing) {
            setIsAnimating(false);
          }
        }}
        style={{ 
           transform: (isPulling || isRefreshing || pullDist > 0 || isAnimating) ? `translateY(${pullDist}px)` : 'none',
           transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {children}
      </div>
    </div>
  );
}

