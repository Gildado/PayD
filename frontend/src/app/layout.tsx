import type { Metadata } from 'next'
import '@/styles/globals.css'
import RootProviders from '@/providers/RootProviders'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'PayD — Decentralized Payroll & Treasury on Stellar',
  description:
    'Manage payroll streaming, token vesting, and multi-sig treasury operations on-chain with Stellar Soroban smart contracts.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased font-sans">
        <RootProviders>
          <Navbar />
          <main className="min-h-screen bg-zinc-950 text-white">
            {children}
          </main>
        </RootProviders>
      </body>
    </html>
  )
}
