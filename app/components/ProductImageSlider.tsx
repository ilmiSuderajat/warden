"use client"
import { useEffect, useRef, useState } from "react"
import { ImageOff } from "lucide-react"

export default function ProductImageSlider({ images, name, autoSlide = true, fitMode = "cover" }: { images?: string[] | string; name?: string; autoSlide?: boolean; fitMode?: "cover" | "contain" }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Support string atau array
  const imageList =
    typeof images === "string"
      ? images
        ? [images]
        : []
      : Array.isArray(images)
      ? images.filter((url) => url)
      : []

  const isSlider = imageList.length > 1

  useEffect(() => {
    if (!isSlider || !autoSlide) return

    const interval = setInterval(() => {
      if (!scrollRef.current) return

      const nextIndex = (activeIndex + 1) % imageList.length
      const width = scrollRef.current.clientWidth

      scrollRef.current.scrollTo({
        left: width * nextIndex,
        behavior: "smooth",
      })

      setActiveIndex(nextIndex)
    }, 3000)

    return () => clearInterval(interval)
  }, [activeIndex, isSlider, imageList.length, autoSlide])

  return (
    <div
      ref={scrollRef}
      className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
    >
      {imageList.length === 0 && (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <ImageOff size={20} className="text-gray-300" />
        </div>
      )}

      {imageList.map((url, idx) => (
        <div key={idx} className="w-full h-full shrink-0 snap-center">
          <img
            src={url}
            alt={`${name ?? "product"}-${idx}`}
            className={`w-full h-full ${fitMode === "contain" ? "object-contain" : "object-cover"}`}
          />
        </div>
      ))}
    </div>
  )
}
