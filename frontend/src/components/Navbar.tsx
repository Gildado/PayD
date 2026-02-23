'use client'

import React from 'react'
import Link from 'next/link'
import WalletButton from './WalletButton'

export default function Navbar() {
    return (
        <nav className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl group-hover:scale-110 transition-transform">
                                P
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                                PayD
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-6">
                            <Link href="/treasury" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                Treasury
                            </Link>
                            <Link href="/payroll" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                Payroll
                            </Link>
                            <Link href="/vesting" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                Vesting
                            </Link>
                            <Link href="/governance" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                Governance
                            </Link>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <WalletButton />
                    </div>
                </div>
            </div>
        </nav>
    )
}
