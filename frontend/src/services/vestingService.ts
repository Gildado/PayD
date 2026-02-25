import { Contract, xdr, Address, scValToNative, nativeToScVal, TransactionBuilder, Networks, Keypair, Account } from '@stellar/stellar-sdk';
import { contractService } from './contracts';

export interface VestingConfig {
  beneficiary: string;
  token: string;
  startTime: number;
  cliffSeconds: number;
  durationSeconds: number;
  totalAmount: number;
  claimedAmount: number;
  clawbackAdmin: string;
  isActive: boolean;
}

const NETWORK = import.meta.env.VITE_NETWORK || 'testnet';
const NETWORK_PASSPHRASE = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const RPC_URL = import.meta.env.PUBLIC_STELLAR_RPC_URL?.replace(/\/+$/, '') || 'https://soroban-testnet.stellar.org';

function getContractId(): string {
  const id = contractService.getContractId('vesting_escrow', NETWORK as any);
  if (!id) throw new Error('Vesting contract ID not found in registry');
  return id;
}

export async function simulateSorobanCall(op: xdr.Operation, sourcePublicKey: string): Promise<any> {
  const account = new Account(sourcePublicKey, '0'); // Dummy sequence
  const tx = new TransactionBuilder(account, {
    fee: '1000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const rpcResponse = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'simulateTransaction',
      params: {
        transaction: tx.toEnvelopexdr().toString('base64'),
      },
    }),
  });

  const rpcResult = await rpcResponse.json();
  if (rpcResult.error) {
    throw new Error(rpcResult.error.message);
  }

  if (rpcResult.result?.error) {
    throw new Error(rpcResult.result.error);
  }

  const resultData = rpcResult.result?.results?.[0]?.xdr;
  if (!resultData) {
    return null;
  }

  const scVal = xdr.ScVal.fromXDR(resultData, 'base64');
  return scValToNative(scVal);
}

export async function getVestingConfig(sourcePublicKey: string): Promise<VestingConfig | null> {
  try {
    const contract = new Contract(getContractId());
    const op = contract.call('get_config');
    const result = await simulateSorobanCall(op, sourcePublicKey);
    
    // result should be a map representing VestingConfig
    return {
      beneficiary: result.beneficiary.toString(),
      token: result.token.toString(),
      startTime: Number(result.start_time),
      cliffSeconds: Number(result.cliff_seconds),
      durationSeconds: Number(result.duration_seconds),
      totalAmount: Number(result.total_amount),
      claimedAmount: Number(result.claimed_amount),
      clawbackAdmin: result.clawback_admin.toString(),
      isActive: Boolean(result.is_active),
    };
  } catch (err: any) {
    if (err.message && err.message.includes('Not initialized')) {
      return null; // Contract not initialized yet
    }
    throw err;
  }
}

export async function getClaimableAmount(sourcePublicKey: string): Promise<number> {
  try {
    const contract = new Contract(getContractId());
    const op = contract.call('get_claimable_amount');
    const result = await simulateSorobanCall(op, sourcePublicKey);
    return Number(result);
  } catch (err: any) {
    if (err.message && err.message.includes('Not initialized')) {
      return 0; // Contract not initialized yet
    }
    throw err;
  }
}

export function buildInitializeVestingXdr(
  sourcePublicKey: string,
  funder: string,
  beneficiary: string,
  token: string,
  startTime: number,
  cliffSeconds: number,
  durationSeconds: number,
  amount: number,
  clawbackAdmin: string,
  sequenceNumber: string
): string {
  const contract = new Contract(getContractId());
  
  const args = [
    new Address(funder).toScVal(),
    new Address(beneficiary).toScVal(),
    new Address(token).toScVal(),
    nativeToScVal(startTime, { type: 'u64' }),
    nativeToScVal(cliffSeconds, { type: 'u64' }),
    nativeToScVal(durationSeconds, { type: 'u64' }),
    nativeToScVal(amount, { type: 'i128' }),
    new Address(clawbackAdmin).toScVal(),
  ];

  const op = contract.call('initialize', ...args);
  const account = new Account(sourcePublicKey, sequenceNumber);
  
  const tx = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();

  return tx.toEnvelopexdr().toString('base64');
}

export function buildClaimVestingXdr(sourcePublicKey: string, sequenceNumber: string): string {
  const contract = new Contract(getContractId());
  const op = contract.call('claim');
  const account = new Account(sourcePublicKey, sequenceNumber);
  
  const tx = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();

  return tx.toEnvelopexdr().toString('base64');
}

export function buildClawbackVestingXdr(sourcePublicKey: string, sequenceNumber: string): string {
  const contract = new Contract(getContractId());
  const op = contract.call('clawback');
  const account = new Account(sourcePublicKey, sequenceNumber);
  
  const tx = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();

  return tx.toEnvelopexdr().toString('base64');
}
