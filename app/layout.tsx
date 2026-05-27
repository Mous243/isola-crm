import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import InstallBanner from '@/components/InstallBanner'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ISOLA CRM',
  description: 'CRM personal vendedor ISOLA Foods',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'ISOLA CRM' },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${geist.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <Nav />
        <InstallBanner />
        <main className="pb-24 md:pb-0 md:pl-56 pt-4">
          <div className="max-w-4xl mx-auto px-4">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
