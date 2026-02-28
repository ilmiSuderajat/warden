"use client"

interface SkeletonProps {
    className?: string
}

export default function Skeleton({ className = "" }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-slate-200 rounded-lg ${className}`}
            style={{
                backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite'
            }}
        >
            <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
        </div>
    )
}
