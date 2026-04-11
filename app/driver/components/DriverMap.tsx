"use client"

export default function DriverMap({ center, isOnline }: { center: [number, number], isOnline: boolean }) {
  return (
    <div className="absolute max-w-md mx-auto inset-0 z-0 bg-slate-100 flex items-center justify-center overflow-hidden">
      
      {/* Google Maps iFrame */}
      <iframe
        src={`https://maps.google.com/maps?q=${center[0]},${center[1]}&z=16&output=embed`}
        className="w-full h-full border-0 pointer-events-none"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Driver Map"
      />

      {/* Online Radar Overlay (Centered over the marker) */}
      {isOnline && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center mt-[-20px]">
          {/* Radar Waves */}
          <div className="absolute w-[200px] h-[200px] bg-blue-500/20 rounded-full animate-ping" />
          <div className="absolute w-[150px] h-[150px] bg-blue-500/10 border border-blue-500/20 rounded-full" />
          
          {/* Custom Blue Dot over the maps pin */}
          <div className="w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-lg relative z-10" />
        </div>
      )}
    </div>
  )
}
