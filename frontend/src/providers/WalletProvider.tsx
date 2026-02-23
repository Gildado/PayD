'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface WalletContextType {
    address: string | null
    connectedWalletId: string | null
    isConnected: boolean
    isConnecting: boolean
    connect: () => Promise<void>
    disconnect: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [address, setAddress] = useState<string | null>(null)
    const [connectedWalletId, setConnectedWalletId] = useState<string | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)

    // Initialization and persistence
    useEffect(() => {
        const initKit = async () => {
            try {
                const { StellarWalletsKit, Networks } = await import('@creit.tech/stellar-wallets-kit')
                const { defaultModules: getModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils')

                StellarWalletsKit.init({
                    network: Networks.TESTNET,
                    modules: getModules(),
                })

                const savedAddress = localStorage.getItem('wallet_address')
                const savedWalletId = localStorage.getItem('wallet_id')
                if (savedAddress && savedWalletId) {
                    setAddress(savedAddress)
                    setConnectedWalletId(savedWalletId)
                    StellarWalletsKit.setWallet(savedWalletId)
                }
            } catch (error) {
                console.error('Failed to initialize wallet kit:', error)
            }
        }

        initKit()
    }, [])

    const connect = async () => {
        if (typeof window === 'undefined') return

        setIsConnecting(true)
        try {
            const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit')
            const { address: connectedAddress } = await StellarWalletsKit.authModal()

            setAddress(connectedAddress)
            localStorage.setItem('wallet_address', connectedAddress)
            // Note: We could listen to WALLET_SELECTED event to get the wallet id if needed

            setIsConnecting(false)
        } catch (error) {
            console.error('Wallet connection failed:', error)
            setIsConnecting(false)
        }
    }

    const disconnect = async () => {
        if (typeof window === 'undefined') return

        try {
            const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit')
            setAddress(null)
            setConnectedWalletId(null)
            localStorage.removeItem('wallet_address')
            localStorage.removeItem('wallet_id')
            StellarWalletsKit.disconnect()
        } catch (error) {
            console.error('Logout failed:', error)
        }
    }

    return (
        <WalletContext.Provider
            value={{
                address,
                connectedWalletId,
                isConnected: !!address,
                isConnecting,
                connect,
                disconnect,
            }}
        >
            {children}
        </WalletContext.Provider>
    )
}

export const useWallet = () => {
    const context = useContext(WalletContext)
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider')
    }
    return context
}
