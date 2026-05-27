'use client'
import { useEffect, useState } from 'react'

export default function InstallBanner() {
  const [prompt, setPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  useEffect(() => {
    // Registrar service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Detectar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // iOS detection
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
    setIsIOS(ios)

    // Android/Chrome: capturar evento de instalación
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const instalar = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setPrompt(null)
  }

  // No mostrar si ya está instalada, o si el usuario cerró el banner
  if (isInstalled || dismissed) return null
  // No mostrar si no hay prompt ni iOS
  if (!prompt && !isIOS) return null

  return (
    <>
      {/* Banner principal */}
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50
                      bg-violet-700 rounded-2xl shadow-2xl shadow-violet-900/50 border border-violet-500/30
                      animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-violet-900 rounded-xl flex items-center justify-center shrink-0 text-2xl">
              🏪
            </div>
            <div className="flex-1">
              <p className="font-bold text-white">Instalar ISOLA CRM</p>
              <p className="text-violet-200 text-xs mt-0.5">
                Accede desde tu pantalla de inicio como una app nativa
              </p>
            </div>
            <button onClick={() => setDismissed(true)}
              className="text-violet-300 hover:text-white text-lg leading-none mt-0.5">
              ✕
            </button>
          </div>

          {/* Android / Chrome */}
          {prompt && (
            <button onClick={instalar}
              className="w-full mt-3 bg-white text-violet-700 font-bold py-2.5 rounded-xl text-sm hover:bg-violet-50 transition-colors">
              📲 Instalar en este dispositivo
            </button>
          )}

          {/* iOS */}
          {isIOS && !prompt && (
            <button onClick={() => setShowIOSGuide(true)}
              className="w-full mt-3 bg-white text-violet-700 font-bold py-2.5 rounded-xl text-sm hover:bg-violet-50 transition-colors">
              📲 Ver cómo instalar en iPhone
            </button>
          )}
        </div>
      </div>

      {/* Modal instrucciones iOS */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4"
          onClick={() => setShowIOSGuide(false)}>
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-700"
            onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-4 text-center">Instalar en iPhone / iPad</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">1️⃣</span>
                <p className="text-sm text-slate-300">Toca el botón de compartir <span className="bg-slate-700 px-2 py-0.5 rounded text-white">⬆️</span> en la barra de Safari</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">2️⃣</span>
                <p className="text-sm text-slate-300">Desplázate y toca <span className="bg-slate-700 px-2 py-0.5 rounded text-white">Añadir a pantalla de inicio</span></p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">3️⃣</span>
                <p className="text-sm text-slate-300">Toca <span className="bg-slate-700 px-2 py-0.5 rounded text-white">Añadir</span> — listo, queda como app</p>
              </div>
            </div>
            <button onClick={() => setShowIOSGuide(false)}
              className="w-full mt-6 bg-violet-600 text-white py-2.5 rounded-xl font-medium">
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}
