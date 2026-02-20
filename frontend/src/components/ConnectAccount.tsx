import React from "react";
import { useWallet } from "../providers/WalletProvider";
import { useTranslation } from "react-i18next";

const ConnectAccount: React.FC = () => {
    const { address, connect, disconnect } = useWallet();
    const { t } = useTranslation();

    if (address) {
        return (
            <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-widest text-muted font-mono leading-none mb-1">
                        {t("connectAccount.authenticated")}
                    </span>
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
                    {t("connectAccount.exit")}
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => {
                void connect();
            }}
            className="px-5 py-2 cursor-pointer bg-accent text-xs border border-accent/30 font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-accent/20 text-sm uppercase tracking-wider"
        >
            {t("connectAccount.connect")}{" "}
            <span className="hidden sm:inline">{t("connectAccount.wallet")}</span>
        </button>
    );
};

export default ConnectAccount;
