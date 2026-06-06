'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',          label: 'Dashboard',  icon: '🏠' },
  { href: '/clientes',  label: 'Clientes',   icon: '👥' },
  { href: '/visita',    label: 'Visita',     icon: '📝' },
  { href: '/cobros',    label: 'Cobros',     icon: '💰' },
  { href: '/despachos', label: 'Despachos',  icon: '🚚' },
  { href: '/metricas',  label: 'Métricas',   icon: '📊' },
  { href: '/catalogo',  label: 'Catálogo',   icon: '📦' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <>
      {/* Sidebar desktop */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 bg-slate-900 border-r border-slate-800 p-4 gap-1 z-50">
        <div className="mb-6">
          <p className="text-lg font-bold text-violet-400">ISOLA CRM</p>
          <p className="text-xs text-slate-500">Daniel · Vendedor</p>
        </div>
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              path === l.href
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}>
            <span>{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex z-50">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
              path === l.href ? 'text-violet-400' : 'text-slate-500'
            }`}>
            <span className="text-xl">{l.icon}</span>
            <span className="text-[10px] mt-0.5">{l.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
