"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function PromoBanner() {
    const [banners, setBanners] = useState<any[]>([])
    const [current, setCurrent] = useState(0)

    useEffect(() => {
        const fetchBanners = async () => {
            const { data } = await supabase
                .from("banners")
                .select("*")
                .eq("is_active", true)
                .order("order", { ascending: true })

            if (data && data.length > 0) setBanners(data)
        }
        fetchBanners()
    }, [])

    // Auto-slide setiap 4 detik
    useEffect(() => {
        if (banners.length <= 1) return
        const timer = setInterval(() => {
            setCurrent(prev => (prev + 1) % banners.length)
        }, 4000)
        return () => clearInterval(timer)
    }, [banners.length])

    if (banners.length === 0) return null

    return (
        <div className="px-4  mt-16">
            <div className="relative rounded-2xl overflow-hidden shadow-md shadow-slate-200/50">
                {/* Slides */}
                <div
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${current * 100}%)` }}
                >
                    {banners.map((banner) => {
                        const Wrapper = banner.link_url ? Link : "div"
                        const wrapperProps = banner.link_url ? { href: banner.link_url } : {}

                        return (
                            <div key={banner.id} className="w-full shrink-0">
                                {/* @ts-ignore */}
                                <Wrapper {...wrapperProps} className="block">
                                    <div className="relative aspect-[21/9] bg-slate-100">
                                        <img
                                            src={banner.image_url}
                                            alt={banner.title || "Promo"}
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Overlay teks jika ada */}
                                        {banner.title && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex flex-col justify-center px-5">
                                                <h3 className="text-white text-base font-extrabold leading-tight drop-shadow-md">{banner.title}</h3>
                                                {banner.subtitle && (
                                                    <p className="text-white/80 text-[11px] mt-1 font-medium drop-shadow-sm">{banner.subtitle}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Wrapper>
                            </div>
                        )
                    })}
                </div>

                {/* Dot Indicators */}
                {banners.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {banners.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrent(i)}
                                className={`rounded-full transition-all duration-300 ${i === current
                                    ? 'w-5 h-1.5 bg-white'
                                    : 'w-1.5 h-1.5 bg-white/50'
                                    }`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
