'use client'

import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WalletProvider } from './WalletProvider'
import { NotificationProvider } from './NotificationProvider'
import { SocketProvider } from './SocketProvider'
import { ThemeProvider } from './ThemeProvider'
import '@/i18n'

export default function RootProviders({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                refetchOnWindowFocus: false,
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <NotificationProvider>
                    <SocketProvider>
                        <WalletProvider>
                            {children}
                        </WalletProvider>
                    </SocketProvider>
                </NotificationProvider>
            </ThemeProvider>
        </QueryClientProvider>
    )
}
