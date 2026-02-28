"use client"

import Skeleton from "./Skeleton"

interface ProductCardSkeletonProps {
    view?: "grid" | "list"
}

export default function ProductCardSkeleton({ view = "grid" }: ProductCardSkeletonProps) {
    if (view === "list") {
        return (
            <div className="flex flex-row bg-white border border-gray-100 w-full h-28">
                {/* Image Skeleton */}
                <Skeleton className="w-28 h-28 shrink-0 rounded-none" />

                {/* Info Skeleton */}
                <div className="p-2 flex flex-col justify-between flex-1 min-w-0">
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <div className="mt-2">
                            <Skeleton className="h-4 w-1/3 mt-1" />
                        </div>
                    </div>

                    <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-1">
                            <Skeleton className="h-2 w-8" />
                            <Skeleton className="h-2 w-12" />
                        </div>
                        <Skeleton className="h-2 w-16" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white border border-gray-100 flex flex-col h-full w-full">
            {/* Image Skeleton */}
            <div className="aspect-square w-full">
                <Skeleton className="w-full h-full rounded-none" />
            </div>

            {/* Info Skeleton */}
            <div className="p-2 flex flex-col justify-between flex-1 min-w-0">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <div className="mt-1">
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                </div>

                <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-2 w-6" />
                        <Skeleton className="h-2 w-10" />
                    </div>
                    <Skeleton className="h-2 w-14" />
                </div>
            </div>
        </div>
    )
}
