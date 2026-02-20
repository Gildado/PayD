import React from "react";
import { useWallet } from "../providers/WalletProvider";

const ConnectAccount: React.FC = () => {
    const { address, connect, disconnect } = useWallet();

    if (address) {
        return (
            <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-widest text-muted font-mono leading-none mb-1">Authenticated</span>
                    <span className="text-xs text-accent font-mono leading-none">
                        {address.substring(0, 6)}...{address.substring(address.length - 4)}
                    </span>
                </div>
                <button
                    onClick={() => {
                        void disconnect();
                    }}
                    className="px-4 py-2 glass border-hi text-xs font-bold rounded-lg hover:bg-danger/10 hover:border-danger/30 hover:text-danger transition-all uppercase tracking-wider"
                >
                    Exit
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => {
                void connect();
            }}
            className="px-6 py-2.5 bg-accent text-bg font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-accent/20 text-sm uppercase tracking-wider"
        >
            Connect <span className="hidden sm:inline">Wallet</span>
        </button>
    );
};

export default ConnectAccount;
