"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, useMap, Circle } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// Fix for default marker icons - Lazy loaded to prevent undefined window crashes natively
const getBlueDotIcon = () => {
  if (typeof window === "undefined" || !L) return null
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="background-color: #4285F4; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center[0], center[1], map])
  return null
}

export default function DriverMap({ center, isOnline }: { center: [number, number], isOnline: boolean }) {
  const [mounted, setMounted] = useState(false)
  const [mapIcon, setMapIcon] = useState<any>(null)

  useEffect(() => {
    setMounted(true)
    setMapIcon(getBlueDotIcon())
  }, [])

  if (!mounted) return <div className="w-full h-full bg-slate-100 animate-pulse" />

  return (
    <div className="absolute max-w-md mx-auto inset-0 z-0">
      <MapContainer
        center={center}
        zoom={15}
        zoomControl={false}
        dragging={false}
        touchZoom={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        keyboard={false}
        // @ts-expect-error: tap is a core leaflet MapOption but not mapped in react-leaflet v4 types
        tap={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapIcon && <Marker position={center} icon={mapIcon} />}
        {isOnline && (
          <Circle
            center={center}
            radius={200}
            pathOptions={{ color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.1 }}
          />
        )}
        <ChangeView center={center} />
      </MapContainer>
    </div>
  )
}
