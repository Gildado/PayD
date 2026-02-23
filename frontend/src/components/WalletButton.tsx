/**
 * Wallet Connect Button Component (scaffold).
 * Contributors: see FE-3 for full implementation.
 *
 * States to implement:
 * - Disconnected: Show "Connect Wallet" button
 * - Connecting: Show spinner/loading state
 * - Connected: Show truncated wallet address
 * - Error: Show error state with retry
 */

'use client'

import React from 'react'
import { useWallet } from '@/providers/WalletProvider'
import { Wallet, LogOut, Loader2 } from 'lucide-react'

export default function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet()

  const truncatedAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : ''

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <div className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-mono text-zinc-300">{truncatedAddress}</span>
        </div>
        <button
          onClick={disconnect}
          className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
          title="Disconnect Wallet"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isConnecting ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Wallet className="w-5 h-5" />
      )}
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
