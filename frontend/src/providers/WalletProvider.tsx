import { createContext, useContext, useEffect, useState } from "react";
import { StellarWalletsKit, WalletNetwork, AlbedoModule, FreighterModule, RabetModule, xBullModule } from "@creit.tech/stellar-wallets-kit";
import { useTranslation } from "react-i18next";

interface WalletContextType {
    address: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [address, setAddress] = useState<string | null>(null);
    const [kit, setKit] = useState<StellarWalletsKit | null>(null);
    const { t } = useTranslation();

    useEffect(() => {
        const newKit = new StellarWalletsKit({
            network: WalletNetwork.TESTNET,
            modules: [
                new AlbedoModule(),
                new FreighterModule(),
                new RabetModule(),
                new xBullModule(),
            ]
        });
        setKit(newKit);
    }, []);

    const connect = async () => {
        if (!kit) return;
        try {
            await kit.openModal({
                modalTitle: t("wallet.modalTitle"),
                onWalletSelected: (option) => {
                    void (async () => {
                        const { address } = await kit.getAddress();
                        setAddress(address);
                        console.log("Connected with:", option.id);
                    })();
                },
                onClosed: () => console.log("Modal closed"),
            });
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        }
    };

    const disconnect = () => {
        setAddress(null);
    };

    return (
        <WalletContext.Provider value={{ address, connect, disconnect }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) throw new Error("useWallet must be used within WalletProvider");
    return context;
};
