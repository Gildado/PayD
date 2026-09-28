/**
 * Vesting Escrow Contract — SDK Interoperability Tests
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
  '../../../../target/wasm32-unknown-unknown/release/vesting_escrow.wasm'
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

describe('VestingEscrow Contract SDK Interop', () => {
  beforeAll(async () => {
    server = new SorobanRpc.Server(RPC_URL, { allowHttp: true });
    admin = Keypair.random();
    await fund(admin);

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
      .addOperation(
        contract.call(
          'initialize',
          new Address(admin.publicKey()).toScAddress(),
          new Address(admin.publicKey()).toScAddress(),
          new Address(contractId).toScAddress(),
          nativeToScVal(100000, { type: 'i128' }),
          nativeToScVal(Math.floor(Date.now() / 1000) + 86400, { type: 'u64' }),
          nativeToScVal(3600, { type: 'u64' })
        )
      )
      .setTimeout(300)
      .build();

    const preparedInit = await server.prepareTransaction(initTx);
    preparedInit.sign(admin);
    await server.sendTransaction(preparedInit);

    console.log(`Deployed vesting_escrow: ${contractId}`);
  });

  it('returns contract name', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('name'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    expect(scValToNative(simSuccess.result!.retval)).toBe('vesting_escrow');
  });

  it('get_config returns vesting configuration', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('get_config'))
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

  it('get_vested_amount returns i128', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('get_vested_amount'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    expect(SorobanRpc.Api.isSimulationSuccess(sim)).toBe(true);
  });

  it('get_claimable_amount returns i128', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('get_claimable_amount'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    expect(SorobanRpc.Api.isSimulationSuccess(sim)).toBe(true);
  });

  it('get_locked_amount returns i128', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('get_locked_amount'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    expect(SorobanRpc.Api.isSimulationSuccess(sim)).toBe(true);
  });

  it('preview_vested_amount at future timestamp', async () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 604800; // +7 days
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(
        contract.call('preview_vested_amount', nativeToScVal(futureTimestamp, { type: 'u64' }))
      )
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    expect(SorobanRpc.Api.isSimulationSuccess(sim)).toBe(true);
  });

  it('get_vesting_progress_bps returns u32', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('get_vesting_progress_bps'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    const bps = scValToNative(simSuccess.result!.retval);
    expect(typeof bps === 'number' || typeof bps === 'bigint').toBe(true);
  });

  it('get_version returns u32', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('get_version'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    expect(SorobanRpc.Api.isSimulationSuccess(sim)).toBe(true);
  });

  it('set_paused toggles pause state', async () => {
    const contract = new Contract(contractId);

    // Pause
    const pauseTx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '10000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('set_paused', nativeToScVal(true, { type: 'bool' })))
      .setTimeout(300)
      .build();

    const prepared = await server.prepareTransaction(pauseTx);
    prepared.sign(admin);
    await server.sendTransaction(prepared);

    // Verify paused
    const checkTx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '1000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('is_paused'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(checkTx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    expect(scValToNative(simSuccess.result!.retval)).toBe(true);

    // Unpause
    const unpauseTx = new TransactionBuilder(await server.getAccount(admin.publicKey()), {
      fee: '10000000',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('set_paused', nativeToScVal(false, { type: 'bool' })))
      .setTimeout(300)
      .build();

    const preparedUnpause = await server.prepareTransaction(unpauseTx);
    preparedUnpause.sign(admin);
    await server.sendTransaction(preparedUnpause);
  });
});
