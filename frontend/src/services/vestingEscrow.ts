import {
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk';

export interface VestingConfig {
  admin: string;
  beneficiary: string;
  totalAmount: string;
  cliffDuration: number;
  startTime: number;
  duration: number;
}

export interface VestingSnapshot {
  vestedAmount: string;
  claimableAmount: string;
  lockedAmount: string;
  progressBps: number;
}

export interface VestingProgress {
  vested: string;
  total: string;
  progressBps: number;
  claimable: string;
}

function getRpcUrl(): string {
  const envRpc = import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined;
  return envRpc?.replace(/\/+$/, '') || 'https://soroban-testnet.stellar.org';
}

function getNetworkPassphrase(): string {
  const network = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  return network === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
}

async function simulateRead(contractId: string, method: string, args: unknown[] = []): Promise<unknown> {
  const rpcUrl = getRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const source = import.meta.env.VITE_SOROBAN_READ_SOURCE as string | undefined;
  if (!source) throw new Error('VITE_SOROBAN_READ_SOURCE not set');

  const account = await server.getAccount(source);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const retval = sim.result?.retval;
  if (!retval) return null;
  return scValToNative(retval);
}

function toString(val: unknown, fallback = '0'): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'bigint') return val.toString();
  if (typeof val === 'number') return val.toString();
  return fallback;
}

export async function fetchVestingConfig(contractId: string): Promise<VestingConfig> {
  const raw = await simulateRead(contractId, 'get_config') as Record<string, unknown>;
  return {
    admin: toString(raw?.admin, ''),
    beneficiary: toString(raw?.beneficiary, ''),
    totalAmount: toString(raw?.total_amount ?? raw?.totalAmount),
    cliffDuration: Number(raw?.cliff_duration ?? raw?.cliffDuration ?? 0),
    startTime: Number(raw?.start_time ?? raw?.startTime ?? 0),
    duration: Number(raw?.duration ?? 0),
  };
}

export async function fetchVestingSnapshot(contractId: string): Promise<VestingSnapshot> {
  const raw = await simulateRead(contractId, 'get_vesting_snapshot') as Record<string, unknown>;
  const vested = toString(raw?.vested_amount ?? raw?.vestedAmount);
  const claimable = toString(raw?.claimable_amount ?? raw?.claimableAmount);
  const locked = toString(raw?.locked_amount ?? raw?.lockedAmount);
  const progress = Number(raw?.progress_bps ?? raw?.progressBps ?? 0);

  return { vestedAmount: vested, claimableAmount: claimable, lockedAmount: locked, progressBps: progress };
}

export async function fetchVestedAmount(contractId: string): Promise<string> {
  const raw = await simulateRead(contractId, 'get_vested_amount');
  return toString(raw);
}

export async function fetchClaimableAmount(contractId: string): Promise<string> {
  const raw = await simulateRead(contractId, 'get_claimable_amount');
  return toString(raw);
}

export async function fetchVestingProgress(contractId: string): Promise<VestingProgress> {
  const [vested, claimable, snapshot] = await Promise.all([
    fetchVestedAmount(contractId),
    fetchClaimableAmount(contractId),
    fetchVestingSnapshot(contractId),
  ]);
  return { vested, total: snapshot.lockedAmount, progressBps: snapshot.progressBps, claimable };
}
