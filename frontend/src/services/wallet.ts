import { Keypair, Transaction } from '@stellar/stellar-sdk';

export interface WalletInfo {
  address: string;
  publicKey: string;
  network: 'testnet' | 'mainnet';
}

export interface SignTransactionOptions {
  transactionXdr: string;
  network: 'testnet' | 'public';
  address?: string;
}

type FreighterApi = {
  getPublicKey: () => Promise<string>;
  signTransaction: (
    transactionXdr: string,
    opts: { network: 'testnet' | 'public' }
  ) => Promise<string>;
};

function getFreighterApi(): FreighterApi | null {
  if (typeof window === 'undefined') return null;

  const candidate = (window as Window & { freighterApi?: unknown }).freighterApi;
  if (
    candidate &&
    typeof candidate === 'object' &&
    'getPublicKey' in candidate &&
    typeof candidate.getPublicKey === 'function' &&
    'signTransaction' in candidate &&
    typeof candidate.signTransaction === 'function'
  ) {
    return candidate as FreighterApi;
  }

  return null;
}

export async function getWalletInfo(): Promise<WalletInfo | null> {
  try {
    const freighter = getFreighterApi();
    if (!freighter) {
      return null;
    }

    const result = await freighter.getPublicKey();
    if (result) {
      return {
        address: result,
        publicKey: result,
        network: result.startsWith('G') ? 'testnet' : 'mainnet',
      };
    }
    return null;
  } catch (error) {
    console.error('Freighter not installed:', error);
    return null;
  }
}

export async function signTransactionWithWallet(options: SignTransactionOptions): Promise<string> {
  const { transactionXdr, network } = options;
  const freighter = getFreighterApi();
  if (!freighter) {
    throw new Error('Freighter API is not available');
  }

  const signed: unknown = await freighter.signTransaction(transactionXdr, { network });
  if (typeof signed !== 'string') {
    throw new Error('Wallet returned an invalid signed transaction response');
  }
  return signed;
}

export function signTransactionObject(keypair: Keypair, transaction: Transaction): Transaction {
  const signable = transaction as Transaction & { sign: (kp: Keypair) => void };
  signable.sign(keypair);
  return transaction;
}

export interface ConnectionState {
  connected: boolean;
  address?: string;
  error?: string;
}

export function createConnectionState(
  connected: boolean,
  address?: string,
  error?: string
): ConnectionState {
  return { connected, address, error };
}
