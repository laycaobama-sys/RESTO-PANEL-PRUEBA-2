'use client'

// Global error boundary — catches errors that the root error.tsx
// can't (e.g., errors in the root layout itself).
// Must render its own <html> and <body> tags.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, backgroundColor: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f5f5f0', marginBottom: '0.5rem' }}>
              Error crítico
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#a3a3a3', marginBottom: '1.5rem' }}>
              La aplicación no pudo cargarse. Recarga la página o contacta con soporte.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre style={{ fontSize: '0.75rem', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1.5rem', overflow: 'auto', maxHeight: '8rem', color: '#fca5a5' }}>
                {error.message}
              </pre>
            )}
            <button
              onClick={reset}
              style={{
                backgroundColor: '#C5A059',
                color: '#0a0a0a',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
