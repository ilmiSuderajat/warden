"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// Fix for default marker icons in Next.js/React-Leaflet
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

interface DraggableMapProps {
  initialLat: number | null
  initialLng: number | null
  onLocationSelect: (lat: number, lng: number) => void
}

function LocationMarker({ position, setPosition, onLocationSelect }: any) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng)
      onLocationSelect(e.latlng.lat, e.latlng.lng)
      map.flyTo(e.latlng, map.getZoom())
    },
  })

  // Sinkronisasi jika initialPosition berubah dari luar (misal GPS deteksi)
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15)
    }
  }, [position, map])

  return position === null ? null : (
    <Marker
      position={position}
      icon={defaultIcon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target
          const newPos = marker.getLatLng()
          setPosition(newPos)
          onLocationSelect(newPos.lat, newPos.lng)
        },
      }}
    />
  )
}

export default function DraggableMap({ initialLat, initialLng, onLocationSelect }: DraggableMapProps) {
  const defaultCenter = { lat: -6.200000, lng: 106.816666 } // Jakarta Pusat as fallback
  const startPos = initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  const [position, setPosition] = useState<L.LatLngExpression | null>(startPos)

  // Sync initial position when it's updated from the parent (e.g., GPS detection)
  useEffect(() => {
    if (initialLat !== null && initialLng !== null) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setPosition({ lat: initialLat, lng: initialLng })
    }
  }, [initialLat, initialLng])

  return (
    <div className="h-64 w-full rounded-xl overflow-hidden shadow-sm border border-slate-200 z-10 relative">
      <MapContainer 
        center={startPos || defaultCenter} 
        zoom={13} 
        scrollWheelZoom={true} 
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} setPosition={setPosition} onLocationSelect={onLocationSelect} />
      </MapContainer>
      
      {/* Target Crosshair Visual Hint if no marker yet */}
      {!position && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[400]">
            <div className="w-10 h-10 border-2 border-indigo-600 rounded-full flex items-center justify-center opacity-50">
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
            </div>
        </div>
      )}
    </div>
  )
}
