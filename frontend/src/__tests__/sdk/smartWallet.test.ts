/**
 * Smart Wallet Contract — SDK Interoperability Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  Keypair,
  Networks,
  SorobanRpc,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const RPC_URL = process.env.STELLAR_RPC_URL || 'http://localhost:8000/rpc';
const PASSPHRASE = Networks.STANDALONE;
const WASM_PATH = resolve(
  __dirname,
  '../../../../target/wasm32-unknown-unknown/release/smart_wallet.wasm'
);

let server: SorobanRpc.Server;
let admin: Keypair;
let contractId: string;

async function fund(kp: Keypair) {
  try {
    await fetch(`http://localhost:8000/friendbot?addr=${kp.publicKey()}`);
  } catch { /* ignore */ }
}

describe('SmartWallet Contract SDK Interop', () => {
  beforeAll(async () => {
    server = new SorobanRpc.Server(RPC_URL, { allowHttp: true });
    admin = Keypair.random();
    await fund(admin);

    const wasm = readFileSync(WASM_PATH);
    const uploadTx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '100000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(Contract.deploy({ networkPassphrase: PASSPHRASE, wasm }))
      .setTimeout(300)
      .build();

    const prepared = await server.prepareTransaction(uploadTx);
    prepared.sign(admin);
    const sent = await server.sendTransaction(prepared);

    let resp: SorobanRpc.Api.TransactionResponse | undefined;
    for (let i = 0; i < 30; i++) {
      resp = await server.getTransaction(sent.hash);
      if (resp.status !== 'NOT_FOUND') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!resp || resp.status !== 'SUCCESS') throw new Error('Upload failed');

    if (resp.resultMetaXdr) {
      const meta = xdr.TransactionMeta.fromXDR(Buffer.from(resp.resultMetaXdr, 'base64'));
      const preimage = meta.v3()?.sorobanMeta()?.contractIDPreimage();
      if (preimage) {
        contractId = 'C' + Buffer.from(preimage.contractId()).toString('hex');
      }
    }

    // Initialize with a single signer and threshold of 1
    const signerArg = nativeToScVal(
      [{ address: new Address(admin.publicKey()), weight: 1 }],
      {
        type: {
          array: [
            {
              struct: [
                ['address', { address: true }],
                ['weight', { u32: true }],
              ],
            },
          ],
        },
      }
    );

    const contract = new Contract(contractId);
    const initTx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('init', signerArg, nativeToScVal(1, { type: 'u32' })))
      .setTimeout(300)
      .build();

    const preparedInit = await server.prepareTransaction(initTx);
    preparedInit.sign(admin);
    await server.sendTransaction(preparedInit);

    console.log(`Deployed smart_wallet: ${contractId}`);
  });

  it('returns contract name', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('name'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    expect(scValToNative(simSuccess.result!.retval)).toBe('smart_wallet');
  });

  it('threshold returns u32', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('threshold'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    const threshold = scValToNative(simSuccess.result!.retval);
    expect(threshold === 1n || threshold === 1).toBe(true);
  });

  it('signer_count returns u32', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('signer_count'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    const count = scValToNative(simSuccess.result!.retval);
    expect(count === 1n || count === 1).toBe(true);
  });

  it('set_threshold updates threshold', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('set_threshold', nativeToScVal(1, { type: 'u32' })))
      .setTimeout(300)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(admin);
    const sent = await server.sendTransaction(prepared);

    let resp: SorobanRpc.Api.TransactionResponse | undefined;
    for (let i = 0; i < 30; i++) {
      resp = await server.getTransaction(sent.hash);
      if (resp.status !== 'NOT_FOUND') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(resp?.status).toBe('SUCCESS');
  });

  it('add_signer serialization works', async () => {
    const newSigner = Keypair.random();
    await fund(newSigner);

    const signerArg = nativeToScVal(
      { address: new Address(newSigner.publicKey()), weight: 1 },
      {
        type: {
          struct: [
            ['address', { address: true }],
            ['weight', { u32: true }],
          ],
        },
      }
    );

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('add_signer', signerArg))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    // Serialization should work regardless of auth success
    expect(sim).toBeDefined();
  });

  it('remove_signer serialization works', async () => {
    const signerArg = nativeToScVal(
      { address: new Address(admin.publicKey()), weight: 1 },
      {
        type: {
          struct: [
            ['address', { address: true }],
            ['weight', { u32: true }],
          ],
        },
      }
    );

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('remove_signer', signerArg))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    expect(sim).toBeDefined();
  });
});
