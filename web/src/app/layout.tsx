import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed, Geist_Mono } from 'next/font/google'

import './globals.css'

const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LAB33 Training System Web',
  description: 'Next.js migration scaffold for the LAB33 Training System.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-Hant" className={`${barlow.variable} ${barlowCondensed.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-transparent text-slate-900">{children}</body>
    </html>
  )
}
