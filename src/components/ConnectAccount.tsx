import React, { useState } from "react";
import { Button, Icon } from "@stellar/design-system";

const ConnectAccount: React.FC = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = () => {
    setIsConnecting(true);
    // Simulate connection
    setTimeout(() => {
      setAddress("GDUK...W6QS");
      setIsConnecting(false);
    }, 1000);
  };

  const disconnect = () => {
    setAddress(null);
  };

  if (address) {
    return (
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-mono leading-none mb-1">
            Stellar
          </span>
          <span className="text-xs text-accent font-mono font-bold leading-none">
            {address}
          </span>
        </div>
        <Button variant="tertiary" size="md" onClick={disconnect}>
          <Icon.LogOut01 size="sm" />
          Exit
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      size="md"
      onClick={connect}
      disabled={isConnecting}
      className="!bg-accent !text-white"
    >
      {isConnecting ? (
        <span className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Connecting...
        </span>
      ) : (
        <>
          <Icon.Wallet01 size="sm" />
          Connect Wallet
        </>
      )}
    </Button>
  );
};

export default ConnectAccount;
