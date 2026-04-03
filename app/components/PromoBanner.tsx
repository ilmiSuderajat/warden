"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function PromoBanner() {
    const [banners, setBanners] = useState<any[]>([])
    const [current, setCurrent] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchBanners = async () => {
            const { data } = await supabase
                .from("banners")
                .select("*")
                .eq("is_active", true)
                .order("order", { ascending: true })

            if (data && data.length > 0) setBanners(data)
            setIsLoading(false)
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

    if (isLoading) {
        return (
            <div>
                <div className="skeleton-shimmer rounded-2xl aspect-[21/9] w-full" />
            </div>
        )
    }

    if (banners.length === 0) return null

    return (
        <div className="h-full flex flex-col justify-center">
            <div className="relative rounded-2xl overflow-hidden shadow-sm h-full">
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
                                    <div className="relative aspect-[3/4] bg-slate-100">
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
                                    ? 'w-5 h-1.5 '
                                    : 'w-1.5 h-1.5 '
                                    }`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
