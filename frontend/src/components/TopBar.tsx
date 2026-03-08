import React from 'react';
import { Menu, Wallet } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import ConnectAccount from './ConnectAccount';
import { useEmployer } from '../hooks/useEmployer';
import { useTranslation } from 'react-i18next';
import { Heading, Text } from '@stellar/design-system';

interface TopBarProps {
    onMenuToggle: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuToggle }) => {
    const { data } = useEmployer();
    const { t } = useTranslation();

    return (
        <header
            className="sticky top-0 z-30 h-16 w-full flex items-center justify-between px-6 border-b border-(--border-hi) backdrop-blur-xl backdrop-saturate-150"
            style={{
                background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
            }}
        >
            <div className="flex items-center gap-4">
                {/* Mobile menu toggle */}
                <button
                    className="lg:hidden p-2 text-(--muted) hover:bg-white/5 rounded-lg active:scale-95 transition"
                    onClick={onMenuToggle}
                >
                    <Menu size={20} />
                </button>

                {/* Organization Info */}
                <div className="flex flex-col justify-center">
                    <Heading as="h1" size="sm" weight="bold" addlClassName="tracking-tight leading-none mb-1">
                        {data.organizationName}
                    </Heading>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="w-1.5 h-1.5 rounded-full bg-(--accent) animate-pulse shadow-[0_0_6px_var(--accent)]" />
                        <span className="text-[10px] font-mono text-(--muted) tracking-widest uppercase">
                            Stellar Mainnet · Connected
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-6 ml-auto">
                {/* Balance Display */}
                <div className="hidden sm:flex flex-col items-end mr-2 bg-(--surface-hi)/40 px-3 py-1.5 rounded-xl border border-(--border-hi)">
                    <div className="flex items-center gap-1.5">
                        <Wallet size={12} className="text-(--accent)" />
                        <Text as="span" size="xs" weight="bold" addlClassName="text-(--muted) uppercase tracking-widest">
                            Current Balance
                        </Text>
                    </div>
                    <span className="text-sm font-mono font-bold tracking-tight mt-0.5">
                        {data.balance} <span className="text-(--accent)">{data.currency}</span>
                    </span>
                </div>

                <div className="h-8 w-px bg-(--border-hi) hidden sm:block" />

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <ConnectAccount />
                </div>
            </div>
        </header>
    );
};

export default TopBar;
