import type { Metadata } from 'next'
import '@/styles/globals.css'
import { WalletProvider } from '@/providers/WalletProvider'
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
        <WalletProvider>
          <Navbar />
          <main className="min-h-screen bg-zinc-950 text-white">
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  )
}
