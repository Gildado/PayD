import { useCallback, useState } from 'react';
import {
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { useNotification } from './useNotification';
import { useWallet } from './useWallet';
import { useWalletSigning } from './useWalletSigning';
import { simulateTransaction } from '../services/transactionSimulation';

type SorobanNativeArg = string | number | bigint | boolean | null;

type SorobanArg = SorobanNativeArg | xdr.ScVal;

interface InvokeOptions<TResult> {
  method: string;
  args?: SorobanArg[];
  parseResult?: (value: unknown) => TResult;
  rpcUrl?: string;
  networkPassphrase?: string;
  fee?: string;
  timeoutSeconds?: number;
}

interface SorobanInvokeResult<TResult> {
  txHash: string;
  value: TResult | null;
  raw: unknown;
}

interface UseSorobanContractState<TResult> {
  invoke: (options: InvokeOptions<TResult>) => Promise<SorobanInvokeResult<TResult>>;
  loading: boolean;
  error: string | null;
  result: SorobanInvokeResult<TResult> | null;
}

const DEFAULT_TIMEOUT_SECONDS = 60;
const DEFAULT_POLL_INTERVAL_MS = 1_500;
const DEFAULT_MAX_POLL_ATTEMPTS = 20;

function getRpcUrl(override?: string): string {
  if (override) return override.replace(/\/+$/, '');
  const envRpc = import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined;
  return envRpc?.replace(/\/+$/, '') || 'https://soroban-testnet.stellar.org';
}

function getNetworkPassphrase(override?: string): string {
  if (override) return override;
  const network = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  return network === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
}

function isScVal(value: SorobanArg): value is xdr.ScVal {
  return typeof value === 'object' && value !== null && 'switch' in value;
}

function toScVal(arg: SorobanArg): xdr.ScVal {
  if (isScVal(arg)) return arg;
  return nativeToScVal(arg);
}

function getResultValue(response: rpc.Api.GetTransactionResponse): unknown {
  if (response.status !== rpc.Api.GetTransactionStatus.SUCCESS) return null;
  const returnValue = response.returnValue;
  if (!returnValue) return null;
  return scValToNative(returnValue);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useSorobanContract<TResult = unknown>(
  contractId: string
): UseSorobanContractState<TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SorobanInvokeResult<TResult> | null>(null);

  const { address } = useWallet();
  const { sign } = useWalletSigning();
  const { notifyError } = useNotification();

  const invoke = useCallback(
    async (options: InvokeOptions<TResult>): Promise<SorobanInvokeResult<TResult>> => {
      setLoading(true);
      setError(null);

      try {
        if (!address) {
          throw new Error('Connect your wallet before invoking a Soroban contract.');
        }

        const rpcUrl = getRpcUrl(options.rpcUrl);
        const rpcServer = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
        const account = await rpcServer.getAccount(address);
        const contract = new Contract(contractId);

        const transaction = new TransactionBuilder(account, {
          fee: options.fee ?? BASE_FEE,
          networkPassphrase: getNetworkPassphrase(options.networkPassphrase),
        })
          .addOperation(contract.call(options.method, ...(options.args ?? []).map(toScVal)))
          .setTimeout(options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS)
          .build();

        const simulation = await simulateTransaction({
          envelopeXdr: transaction.toXDR(),
          horizonUrl: import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string | undefined,
        });

        if (!simulation.success) {
          throw new Error(simulation.description || 'Simulation failed');
        }

        const preparedTx = await rpcServer.prepareTransaction(transaction);
        const signedXdr = await sign(preparedTx.toXDR());
        const signedTx = TransactionBuilder.fromXDR(
          signedXdr,
          getNetworkPassphrase(options.networkPassphrase)
        );
        const sendResponse = await rpcServer.sendTransaction(signedTx);

        if (sendResponse.status === 'ERROR') {
          throw new Error('Soroban contract submission failed.');
        }

        let txResponse: rpc.Api.GetTransactionResponse | null = null;
        for (let attempt = 0; attempt < DEFAULT_MAX_POLL_ATTEMPTS; attempt += 1) {
          const current = await rpcServer.getTransaction(sendResponse.hash);
          if (current.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
            txResponse = current;
            break;
          }
          await sleep(DEFAULT_POLL_INTERVAL_MS);
        }

        if (!txResponse) {
          throw new Error('Transaction submission timed out before confirmation.');
        }

        if (txResponse.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
          throw new Error(`Transaction failed with status: ${txResponse.status}`);
        }

        const raw = getResultValue(txResponse);
        const typedValue = options.parseResult ? options.parseResult(raw) : (raw as TResult | null);
        const nextResult: SorobanInvokeResult<TResult> = {
          txHash: sendResponse.hash,
          value: typedValue,
          raw,
        };

        setResult(nextResult);
        return nextResult;
      } catch (invokeError) {
        const message =
          invokeError instanceof Error ? invokeError.message : 'Contract invocation failed';
        setError(message);
        notifyError('Contract invocation failed', message);
        throw invokeError;
      } finally {
        setLoading(false);
      }
    },
    [address, contractId, notifyError, sign]
  );

  return {
    invoke,
    loading,
    error,
    result,
  };
}
