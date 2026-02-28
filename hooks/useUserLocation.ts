"use client"

import { useState, useEffect } from "react"

export interface UserLocation {
    latitude: number
    longitude: number
}

export function useUserLocation() {
    const [location, setLocation] = useState<UserLocation | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser")
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                })
            },
            (err) => {
                setError(err.message)
            },
            { enableHighAccuracy: true }
        )
    }, [])

    return { location, error }
}
