import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';

const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org';
const DEFAULT_NETWORK = Networks.TESTNET;
const POLL_INTERVAL_MS = 1200;
const MAX_ATTEMPTS = 20;

export interface WithdrawRequest {
  contractId: string;
  claimantAddress: string;
  streamId: string;
  signTransaction: (xdr: string) => Promise<string>;
  rpcUrl?: string;
  networkPassphrase?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function submitWithdrawTransaction({
  contractId,
  claimantAddress,
  streamId,
  signTransaction,
  rpcUrl = import.meta.env.PUBLIC_STELLAR_RPC_URL || DEFAULT_RPC_URL,
  networkPassphrase = import.meta.env.PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : DEFAULT_NETWORK,
}: WithdrawRequest): Promise<{ hash: string }> {
  if (!contractId) {
    throw new Error('Missing Soroban stream contract id.');
  }

  const server = new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const source = await server.getAccount(claimantAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        'withdraw',
        new Address(claimantAddress).toScVal(),
        nativeToScVal(streamId, { type: 'string' })
      )
    )
    .setTimeout(60)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error || 'Failed to simulate withdraw transaction.');
  }

  const prepared = SorobanRpc.assembleTransaction(tx, simulation).build();
  const signedXdr = await signTransaction(prepared.toXDR());
  const sendResult = await server.sendTransaction(TransactionBuilder.fromXDR(signedXdr, networkPassphrase));

  if (sendResult.status === SorobanRpc.Api.SendTransactionStatus.ERROR) {
    throw new Error('Withdraw transaction submission failed.');
  }

  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const txStatus = await server.getTransaction(sendResult.hash);
    if (txStatus.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash: sendResult.hash };
    }
    if (txStatus.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Withdraw transaction failed on-chain.');
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('Timed out waiting for withdraw confirmation.');
}
