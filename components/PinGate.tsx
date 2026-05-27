'use client'
import { useEffect, useState } from 'react'

const PIN_CORRECTO = '1234'
const KEY = 'isola_auth'

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<boolean | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    setAuth(localStorage.getItem(KEY) === 'ok')
  }, [])

  const verificar = () => {
    if (input === PIN_CORRECTO) {
      localStorage.setItem(KEY, 'ok')
      setAuth(true)
    } else {
      setError(true)
      setInput('')
      setTimeout(() => setError(false), 1500)
    }
  }

  if (auth === null) return null

  if (!auth) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-xs space-y-6 text-center">
        <div className="space-y-1">
          <p className="text-4xl">🔒</p>
          <h1 className="text-xl font-bold text-violet-400">ISOLA CRM</h1>
          <p className="text-sm text-slate-400">Ingresa tu PIN</p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={input}
            onChange={e => setInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && verificar()}
            autoFocus
            className={`w-full text-center text-2xl tracking-widest bg-slate-900 border rounded-xl px-4 py-4 outline-none transition-colors
              ${error ? 'border-red-500 text-red-400' : 'border-slate-700 focus:border-violet-500'}`}
            placeholder="••••"
          />
          {error && <p className="text-red-400 text-sm">PIN incorrecto</p>}
          <button onClick={verificar}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl font-medium">
            Entrar
          </button>
        </div>

        {/* Teclado numérico para móvil */}
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
            <button key={i} onClick={() => {
              if (n === '⌫') setInput(p => p.slice(0, -1))
              else if (n !== '') setInput(p => p.length < 6 ? p + n : p)
            }}
              className={`py-4 rounded-xl text-lg font-medium transition-colors
                ${n === '' ? '' : n === '⌫' ? 'bg-slate-800 hover:bg-slate-700 text-red-400' : 'bg-slate-800 hover:bg-slate-700'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return <>{children}</>
}
