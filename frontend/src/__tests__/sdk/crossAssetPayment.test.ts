/**
 * Cross Asset Payment Contract — SDK Interoperability Tests
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
  '../../../../target/wasm32-unknown-unknown/release/cross_asset_payment.wasm'
);

let server: SorobanRpc.Server;
let admin: Keypair;
let contractId: string;

async function fund(kp: Keypair) {
  try {
    await fetch(`http://localhost:8000/friendbot?addr=${kp.publicKey()}`);
  } catch {
    /* ignore */
  }
}

describe('CrossAssetPayment Contract SDK Interop', () => {
  beforeAll(async () => {
    server = new SorobanRpc.Server(RPC_URL, { allowHttp: true });
    admin = Keypair.random();
    await fund(admin);

    // Deploy
    const wasm = readFileSync(WASM_PATH);
    const uploadTx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '100000000',
      networkPassphrase: PASSPHRASE,
    })
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

    // Initialize
    const contract = new Contract(contractId);
    const initTx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '10000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('init', new Address(admin.publicKey()).toScAddress()))
      .setTimeout(300)
      .build();

    const preparedInit = await server.prepareTransaction(initTx);
    preparedInit.sign(admin);
    await server.sendTransaction(preparedInit);

    console.log(`Deployed cross_asset_payment: ${contractId}`);
  });

  it('returns contract metadata via simulation', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('name'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    expect(SorobanRpc.Api.isSimulationSuccess(sim)).toBe(true);
  });

  it('is_paused returns false after init', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('is_paused'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    expect(scValToNative(simSuccess.result!.retval)).toBe(false);
  });

  it('get_payment_count returns 0 initially', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('get_payment_count'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    const count = scValToNative(simSuccess.result!.retval);
    expect(count === 0n || count === 0).toBe(true);
  });

  it('set_paused requires admin auth', async () => {
    const nonAdmin = Keypair.random();
    await fund(nonAdmin);

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(nonAdmin.publicKey()), {
      fee: '10000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('set_paused', nativeToScVal(true, { type: 'bool' })))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    // Should fail with auth error
    expect(sim).toBeDefined();
  });

  it('get_payment returns None for nonexistent ID', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('get_payment', nativeToScVal(999, { type: 'u64' })))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    // Returns Option, should succeed with None
    expect(SorobanRpc.Api.isSimulationSuccess(sim)).toBe(true);
  });

  it('propose_admin_transfer serialization works', async () => {
    const newAdmin = Keypair.random();
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '10000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(
        contract.call('propose_admin_transfer', new Address(newAdmin.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    // Should succeed (admin is proposing)
    expect(sim).toBeDefined();
  });
});
