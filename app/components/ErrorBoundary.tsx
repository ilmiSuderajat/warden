"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

interface Props {
  children?: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center bg-white rounded-2xl border border-zinc-100 m-4 shadow-sm">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-2">Terjadi Kesalahan</h2>
          <p className="text-sm text-zinc-500 mb-6 max-w-[240px]">
            Gagal memuat halaman ini. Silakan coba muat ulang halaman.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-zinc-900/10"
          >
            <RefreshCw size={16} />
            Muat Ulang
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-6 p-4 bg-zinc-50 rounded-lg text-left text-[10px] text-red-600 overflow-auto max-w-full">
              {this.state.error?.message}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
