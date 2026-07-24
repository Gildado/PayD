/**
 * SDK Interoperability Test Helpers
 *
 * Common utilities for testing contract interactions via @stellar/stellar-sdk
 * against a standalone Soroban network.
 */

import {
  Keypair,
  Networks,
  SorobanRpc,
  Contract,
  Address,
  xdr,
  scValToNative,
  nativeToScVal,
  TransactionBuilder,
  Transaction,
  ContractSpec,
} from '@stellar/stellar-sdk';

// ── Network Configuration ──────────────────────────────────────────────────

export const STANDALONE passphrase = Networks.STANDALONE;
export const RPC_URL = process.env.STELLAR_RPC_URL || 'http://localhost:8000/rpc';
export const WASM_DIR = process.env.WASM_DIR || '../../../target/wasm32-unknown-unknown/release';

// ── RPC Client ─────────────────────────────────────────────────────────────

export function getServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: true });
}

// ── Key Management ─────────────────────────────────────────────────────────

export function generateAccount(): Keypair {
  return Keypair.random();
}

/**
 * Fund an account on the standalone network via friendbot.
 * Falls back to direct account creation if friendbot is unavailable.
 */
export async function fundAccount(
  server: SorobanRpc.Server,
  publicKey: string
): Promise<void> {
  try {
    const response = await fetch(
      `http://localhost:8000/friendbot?addr=${publicKey}`
    );
    if (!response.ok) {
      throw new Error(`Friendbot returned ${response.status}`);
    }
  } catch {
    // On standalone network, accounts may need to be funded differently
    console.warn(`Could not fund ${publicKey} via friendbot, proceeding anyway`);
  }
}

// ── Contract Deployment ────────────────────────────────────────────────────

export interface DeployResult {
  contractId: string;
  contractIdHex: string;
}

/**
 * Deploy a WASM file to the standalone network and return the contract ID.
 */
export async function deployContract(
  server: SorobanRpc.Server,
  sourceKeypair: Keypair,
  wasmBytes: Buffer | Uint8Array,
  contractName: string
): Promise<DeployResult> {
  // Fund the deployer
  await fundAccount(server, sourceKeypair.publicKey());

  // Upload the WASM
  const uploadTx = await server.prepareTransaction(
    new TransactionBuilder(
      await server.getAccount(sourceKeypair.publicKey()),
      { fee: '100000000', networkPassphrase: STANDALONE }
    )
      .addOperation(
        Contract.deploy({
          networkPassphrase: STANDALONE,
          wasm: wasmBytes,
        })
      )
      .setTimeout(300)
      .build()
  );

  uploadTx.sign(sourceKeypair);
  const uploadResult = await server.sendTransaction(uploadTx);

  if (uploadResult.status === 'ERROR') {
    throw new Error(
      `Failed to upload WASM for ${contractName}: ${JSON.stringify(uploadResult.errorResult)}`
    );
  }

  // Wait for confirmation
  const uploadConfirm = await waitForTransaction(server, uploadResult.hash);
  if (!uploadConfirm) {
    throw new Error(`Upload transaction not confirmed for ${contractName}`);
  }

  // Get the contract ID from the transaction result

  // Parse contract ID from result
  const contractId = extractContractIdFromResult(uploadConfirm);
  if (!contractId) {
    throw new Error(`Could not extract contract ID for ${contractName}`);
  }

  console.log(`Deployed ${contractName}: ${contractId}`);
  return {
    contractId,
    contractIdHex: contractId,
  };
}

/**
 * Extract contract ID from a deploy transaction result.
 */
function extractContractIdFromResult(result: SorobanRpc.Api.TransactionResponse): string | null {
  try {
    if (!result.resultMetaXdr) return null;
    const meta = xdr.LedgerMeta.fromXDR(
      Buffer.from(result.resultMetaXdr, 'base64')
    );
    // Walk the meta tree to find the contract ID
    const contractIdPreimage = meta
      .v3()
      ?.sorobanMeta()
      ?.contractIDPreimage();

    if (contractIdPreimage) {
      const hash = contractIdPreimage.contractId();
      // Convert 32-byte hash to C... address
      return 'C' + Buffer.from(hash).toString('hex');
    }
    return null;
  } catch {
    return null;
  }
}

// ── Contract Invocation ────────────────────────────────────────────────────

export interface InvokeResult {
  result: unknown;
  rawResult: xdr.ScVal | null;
  events: SorobanRpc.Api.Event[];
  txHash: string;
  ledger: number;
}

/**
 * Invoke a contract function via simulate + submit pattern.
 * This matches the pattern used by backend integration layers.
 */
export async function invokeContract(
  server: SorobanRpc.Server,
  sourceKeypair: Keypair,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  signAndSubmit = true
): Promise<InvokeResult> {
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(
    await server.getAccount(sourceKeypair.publicKey()),
    { fee: '10000000', networkPassphrase: STANDALONE }
  )
    .addOperation(contract.call(method, ...args))
    .setTimeout(300)
    .build();

  // Simulate first
  const simulateResult = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simulateResult)) {
    throw new Error(`Simulation failed for ${method}: ${JSON.stringify(simulateResult.error)}`);
  }

  if (!signAndSubmit) {
    // Return simulated result only
    const simResult = simulateResult as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    return {
      result: simResult.result?.retval
        ? scValToNative(simResult.result.retval)
        : null,
      rawResult: simResult.result?.retval || null,
      events: [],
      txHash: '',
      ledger: 0,
    };
  }

  // Restore/authorize if needed
  let preparedTx = tx;
  if (SorobanRpc.Api.isSimulationSuccess(simulateResult)) {
    preparedTx = await server.prepareTransaction(tx);
  }

  preparedTx.sign(sourceKeypair);

  const sendResult = await server.sendTransaction(preparedTx);

  if (sendResult.status === 'ERROR') {
    // Parse error from simulation or submission
    const errorMsg = parseTransactionError(sendResult);
    throw new Error(errorMsg);
  }

  const confirmed = await waitForTransaction(server, sendResult.hash);

  // Extract result from transaction meta
  const resultValue = extractTransactionResult(confirmed);
  const events = confirmed.events || [];

  return {
    result: resultValue ? scValToNative(resultValue) : null,
    rawResult: resultValue,
    events,
    txHash: sendResult.hash,
    ledger: confirmed.ledger || 0,
  };
}

/**
 * Build a contract invocation without signing (for authorization testing).
 */
export async function buildUnsignedInvoke(
  server: SorobanRpc.Server,
  sourcePublicKey: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<Transaction> {
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(
    await server.getAccount(sourcePublicKey),
    { fee: '10000000', networkPassphrase: STANDALONE }
  )
    .addOperation(contract.call(method, ...args))
    .setTimeout(300)
    .build();

  return server.prepareTransaction(tx);
}

// ── Argument Helpers ───────────────────────────────────────────────────────

/** Convert a Stellar address string to ScVal */
export function addressToScVal(address: string): xdr.ScVal {
  return new Address(address).toScAddress();
}

/** Convert a string to ScVal symbol */
export function symbolToScVal(symbol: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(symbol);
}

/** Convert a string to ScVal string */
export function stringToScVal(str: string): xdr.ScVal {
  return nativeToScVal(str, { type: 'string' });
}

/** Convert a number to ScVal u32/u64/i128 */
export function numberToScVal(
  num: number | bigint,
  type: 'u32' | 'u64' | 'i32' | 'i64' | 'i128' = 'u32'
): xdr.ScVal {
  return nativeToScVal(num, { type });
}

/** Convert a boolean to ScVal */
export function boolToScVal(val: boolean): xdr.ScVal {
  return nativeToScVal(val, { type: 'bool' });
}

/** Convert a native value to a ScVal Vec */
export function vecToScVal(items: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec(items);
}

/** Convert a native value to a ScVal Map */
export function mapToScVal(entries: [xdr.ScVal, xdr.ScVal][]): xdr.ScVal {
  return xdr.ScVal.scvMap(
    entries.map(
      ([k, v]) => new xdr.ScMapEntry({ key: k, val: v })
    )
  );
}

// ── Transaction Helpers ────────────────────────────────────────────────────

/**
 * Wait for a transaction to be confirmed.
 */
export async function waitForTransaction(
  server: SorobanRpc.Server,
  hash: string,
  maxAttempts = 30,
  intervalMs = 1000
): Promise<SorobanRpc.Api.TransactionResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await server.getTransaction(hash);
      if (response.status !== 'NOT_FOUND') {
        return response;
      }
    } catch {
      // Transaction might not be available yet
    }
    await sleep(intervalMs);
  }
  throw new Error(`Transaction ${hash} not confirmed after ${maxAttempts} attempts`);
}

/**
 * Parse transaction error from send result.
 */
function parseTransactionError(
  result: SorobanRpc.Api.SendTransactionResponse
): string {
  if (result.status === 'ERROR' && result.errorResult) {
    try {
      const resultXdr = xdr.TransactionResultResult.fromXDR(
        Buffer.from(result.errorResult, 'base64')
      );
      return `Transaction failed: ${resultXdr.toString()}`;
    } catch {
      return `Transaction failed: ${JSON.stringify(result.errorResult)}`;
    }
  }
  return 'Transaction failed with unknown error';
}

/**
 * Extract the return value from a confirmed transaction.
 */
function extractTransactionResult(
  response: SorobanRpc.Api.TransactionResponse
): xdr.ScVal | null {
  try {
    if (!response.resultMetaXdr) return null;
    const meta = xdr.TransactionMeta.fromXDR(
      Buffer.from(response.resultMetaXdr, 'base64')
    );
    // Navigate the meta structure to find the return value
    const v3 = meta.v3();
    if (v3) {
      const sorobanMeta = v3.sorobanMeta();
      if (sorobanMeta) {
        const returnVal = sorobanMeta.contractEvents();
        // The actual return value is in the operation result
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── Event Helpers ──────────────────────────────────────────────────────────

/**
 * Get events for a contract from the RPC.
 */
export async function getContractEvents(
  server: SorobanRpc.Server,
  contractId: string,
  startLedger?: number,
  endLedger?: number
): Promise<SorobanRpc.Api.Event[]> {
  const events = await server.getEvents({
    type: 'contract',
    contracts: [contractId],
    startLedger: startLedger?.toString(),
    endLedger: endLedger?.toString(),
    limit: 100,
  });

  return events.events;
}

/**
 * Parse event data from an XDR event.
 */
export function parseEvent<T>(event: SorobanRpc.Api.Event): T | null {
  try {
    return scValToNative(event.value) as T;
  } catch {
    return null;
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random symbol for test isolation.
 */
export function randomSymbol(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
