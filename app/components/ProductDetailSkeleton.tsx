"use client"

import Skeleton from "./Skeleton"

export default function ProductDetailSkeleton() {
    return (
        <div className="bg-slate-50 min-h-screen pb-28 max-w-md mx-auto relative font-sans">
            {/* Navbar Skeleton */}
            <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center h-14 px-4 max-w-md mx-auto">
                <Skeleton className="w-8 h-8 rounded-xl" />
                <div className="flex-1"></div>
                <Skeleton className="w-8 h-8 rounded-xl mr-1" />
                <Skeleton className="w-8 h-8 rounded-xl" />
            </nav>

            <div className="pt-14">
                {/* Main Image Skeleton */}
                <div className="bg-white aspect-square">
                    <Skeleton className="w-full h-full rounded-none" />
                </div>

                {/* Product Info Skeleton */}
                <div className="bg-white p-5 border-b border-slate-100">
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-3/4" />
                        <div className="flex gap-3">
                            <Skeleton className="h-4 w-12 rounded-full" />
                            <Skeleton className="h-4 w-20 rounded-full" />
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100/80">
                            <Skeleton className="h-8 w-1/2" />
                            <Skeleton className="h-4 w-1/3 mt-2" />
                        </div>
                    </div>
                </div>

                {/* Shipping Location Skeleton */}
                <div className="mt-2 bg-white px-5 py-4 flex items-center gap-3 border-b border-slate-100">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </div>

                {/* Description Skeleton */}
                <div className="mt-2 bg-white p-5 space-y-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                </div>
            </div>

            {/* Action Bar Skeleton */}
            <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-100 max-w-md mx-auto p-4">
                <div className="flex gap-3">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <Skeleton className="w-14 h-12 rounded-xl" />
                    <div className="flex-1">
                        <Skeleton className="w-full h-12 rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    )
}
