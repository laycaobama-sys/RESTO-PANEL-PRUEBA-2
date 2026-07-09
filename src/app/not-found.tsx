'use client'

import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-8xl font-bold text-[#C5A059] mb-4">404</div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Página no encontrada
        </h2>
        <p className="text-sm text-neutral-400 mb-6">
          La página que buscas no existe o ha sido movida.
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="border-white/15 text-neutral-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]"
          >
            <Home className="w-4 h-4 mr-2" />
            Inicio
          </Button>
        </div>
      </div>
    </div>
  )
}
