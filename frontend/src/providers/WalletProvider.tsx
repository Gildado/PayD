import { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  xBullModule,
  LobstrModule,
} from "@creit.tech/stellar-wallets-kit";
import { useTranslation } from "react-i18next";

interface WalletContextType {
  address: string | null;
  walletName: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const kitRef = useRef<StellarWalletsKit | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const newKit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new LobstrModule(),
      ],
    });
    kitRef.current = newKit;
  }, []);

  const connect = async () => {
    const kit = kitRef.current;
    if (!kit) return;

    setIsConnecting(true);
    try {
      await kit.openModal({
        modalTitle: t("wallet.modalTitle"),
        onWalletSelected: (option) => {
          void (async () => {
            try {
              kit.setWallet(option.id);
              const { address } = await kit.getAddress();
              setAddress(address);
              setWalletName(option.name);
            } catch (error) {
              console.error("Failed to get wallet address:", error);
            } finally {
              setIsConnecting(false);
            }
          })();
        },
        onClosed: () => {
          setIsConnecting(false);
        },
      });
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setWalletName(null);
  };

  const signTransaction = async (xdr: string): Promise<string> => {
    const kit = kitRef.current;
    if (!kit || !address) {
      throw new Error("Wallet not connected");
    }

    const { signedTxXdr } = await kit.signTransaction(xdr, {
      address,
      networkPassphrase: WalletNetwork.TESTNET,
    });

    return signedTxXdr;
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        walletName,
        isConnecting,
        connect,
        disconnect,
        signTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within WalletProvider");
  return context;
};
