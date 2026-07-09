'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to the server (Sentry/LogRocket in production)
    console.error('App error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Algo salió mal
        </h2>
        <p className="text-sm text-neutral-400 mb-6">
          Se produjo un error inesperado. Nuestro equipo ha sido notificado.
          Puedes intentar recargar la página o volver al inicio.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="text-xs text-left bg-black/40 border border-white/10 rounded-lg p-3 mb-6 overflow-auto max-h-32 text-red-300">
            {error.message}
            {error.digest ? `\nDigest: ${error.digest}` : ''}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={reset}
            className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            variant="outline"
            className="border-white/15 text-neutral-300"
          >
            <Home className="w-4 h-4 mr-2" />
            Inicio
          </Button>
        </div>
      </div>
    </div>
  )
}
