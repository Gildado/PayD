import {
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { simulateTransaction } from './transactionSimulation';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';
const DEFAULT_RPC_URL =
  (import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined) ||
  'https://soroban-testnet.stellar.org';

export interface ConversionPath {
  id: string;
  sourceAsset: string;
  destinationAsset: string;
  rate: number;
  fee: number;
  slippage: number;
  estimatedDestinationAmount: number;
  hops: string[];
}

export interface PathfindRequest {
  fromAsset: string;
  toAsset: string;
  amount: number;
}

export interface SubmitCrossAssetPaymentInput {
  contractId: string;
  sourceAddress: string;
  signTransaction: (xdr: string) => Promise<string>;
  amount: number;
  fromAsset: string;
  toAsset: string;
  receiver: string;
  selectedPathId: string;
  rpcUrlOverride?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getNetworkPassphrase(): string {
  const network = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  return network === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
}

function fallbackPaths(request: PathfindRequest): ConversionPath[] {
  const baseRate = request.toAsset === 'NGN' ? 1550 : request.toAsset === 'BRL' ? 5.1 : 1.15;
  const fastFee = Number((request.amount * 0.006).toFixed(4));
  const cheapFee = Number((request.amount * 0.003).toFixed(4));

  return [
    {
      id: 'path-fast',
      sourceAsset: request.fromAsset,
      destinationAsset: request.toAsset,
      rate: baseRate,
      fee: fastFee,
      slippage: 0.35,
      estimatedDestinationAmount: Number((request.amount * baseRate - fastFee).toFixed(4)),
      hops: [request.fromAsset, 'XLM', request.toAsset],
    },
    {
      id: 'path-cheap',
      sourceAsset: request.fromAsset,
      destinationAsset: request.toAsset,
      rate: Number((baseRate * 0.994).toFixed(6)),
      fee: cheapFee,
      slippage: 0.8,
      estimatedDestinationAmount: Number((request.amount * baseRate * 0.994 - cheapFee).toFixed(4)),
      hops: [request.fromAsset, 'USDC', request.toAsset],
    },
  ];
}

export async function fetchConversionPaths(request: PathfindRequest): Promise<ConversionPath[]> {
  const endpoint = `${normalizeBaseUrl(API_BASE_URL)}/api/v1/payments/pathfind`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Pathfinding endpoint unavailable (${response.status})`);
    }

    const payload = (await response.json()) as { paths?: ConversionPath[] };
    if (!payload.paths?.length) {
      return fallbackPaths(request);
    }
    return payload.paths;
  } catch {
    return fallbackPaths(request);
  }
}

export async function submitCrossAssetPayment(
  input: SubmitCrossAssetPaymentInput
): Promise<{ txHash: string }> {
  const rpcUrl = normalizeBaseUrl(input.rpcUrlOverride || DEFAULT_RPC_URL);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(input.sourceAddress);
  const contract = new Contract(input.contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      contract.call(
        'execute_cross_asset_payment',
        nativeToScVal(input.receiver),
        nativeToScVal(input.fromAsset),
        nativeToScVal(input.toAsset),
        nativeToScVal(input.amount),
        nativeToScVal(input.selectedPathId)
      )
    )
    .setTimeout(60)
    .build();

  const simulation = await simulateTransaction({ envelopeXdr: tx.toXDR() });
  if (!simulation.success) {
    throw new Error(simulation.description || 'Simulation failed for cross-asset payment');
  }

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await input.signTransaction(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase());
  const submitted = await server.sendTransaction(signedTx);

  if (submitted.status === 'ERROR') {
    throw new Error('Cross-asset contract submission failed.');
  }

  return { txHash: submitted.hash };
}
