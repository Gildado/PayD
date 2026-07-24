/**
 * OrgUSD Token Contract — SDK Interoperability Tests
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
  '../../../../target/wasm32-unknown-unknown/release/orgusd.wasm'
);

let server: SorobanRpc.Server;
let admin: Keypair;
let contractId: string;

async function fund(kp: Keypair) {
  try {
    await fetch(`http://localhost:8000/friendbot?addr=${kp.publicKey()}`);
  } catch { /* ignore */ }
}

describe('OrgUSD Contract SDK Interop', () => {
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

    const contract = new Contract(contractId);
    const initTx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('initialize', new Address(admin.publicKey()).toScAddress()))
      .setTimeout(300)
      .build();

    const preparedInit = await server.prepareTransaction(initTx);
    preparedInit.sign(admin);
    await server.sendTransaction(preparedInit);

    console.log(`Deployed orgusd: ${contractId}`);
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
    expect(scValToNative(simSuccess.result!.retval)).toBe('orgusd');
  });

  it('total_supply returns i128', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('total_supply'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    const supply = scValToNative(simSuccess.result!.retval);
    expect(typeof supply === 'bigint' || typeof supply === 'number').toBe(true);
  });

  it('balance returns i128 for any account', async () => {
    const account = Keypair.random();
    await fund(account);

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call('balance', new Address(account.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    const balance = scValToNative(simSuccess.result!.retval);
    expect(balance === 0n || balance === 0).toBe(true);
  });

  it('is_authorized returns bool', async () => {
    const account = Keypair.random();
    await fund(account);

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call('is_authorized', new Address(account.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    const authorized = scValToNative(simSuccess.result!.retval);
    expect(typeof authorized).toBe('boolean');
  });

  it('is_frozen returns bool', async () => {
    const account = Keypair.random();
    await fund(account);

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call('is_frozen', new Address(account.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    const simSuccess = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    const frozen = scValToNative(simSuccess.result!.retval);
    expect(typeof frozen).toBe('boolean');
  });

  it('sep1_metadata returns metadata struct', async () => {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(contract.call('sep1_metadata'))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    expect(SorobanRpc.Api.isSimulationSuccess(sim)).toBe(true);
  });

  it('mint serializes correctly', async () => {
    const recipient = Keypair.random();
    await fund(recipient);

    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call(
          'mint',
          new Address(recipient.publicKey()).toScAddress(),
          nativeToScVal(1000, { type: 'i128' })
        )
      )
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

  it('freeze and unfreeze serializes correctly', async () => {
    const account = Keypair.random();
    await fund(account);

    const contract = new Contract(contractId);

    // Freeze
    const freezeTx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call('freeze', new Address(account.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const preparedFreeze = await server.prepareTransaction(freezeTx);
    preparedFreeze.sign(admin);
    const sentFreeze = await server.sendTransaction(preparedFreeze);

    let respFreeze: SorobanRpc.Api.TransactionResponse | undefined;
    for (let i = 0; i < 30; i++) {
      respFreeze = await server.getTransaction(sentFreeze.hash);
      if (respFreeze.status !== 'NOT_FOUND') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(respFreeze?.status).toBe('SUCCESS');

    // Verify frozen
    const checkTx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call('is_frozen', new Address(account.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const simCheck = await server.simulateTransaction(checkTx);
    const simCheckSuccess = simCheck as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    expect(scValToNative(simCheckSuccess.result!.retval)).toBe(true);

    // Unfreeze
    const unfreezeTx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call('unfreeze', new Address(account.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const preparedUnfreeze = await server.prepareTransaction(unfreezeTx);
    preparedUnfreeze.sign(admin);
    await server.sendTransaction(preparedUnfreeze);
  });

  it('authorize and revoke serializes correctly', async () => {
    const account = Keypair.random();
    await fund(account);

    const contract = new Contract(contractId);

    // Authorize
    const authTx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call('authorize', new Address(account.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const preparedAuth = await server.prepareTransaction(authTx);
    preparedAuth.sign(admin);
    const sentAuth = await server.sendTransaction(preparedAuth);

    let respAuth: SorobanRpc.Api.TransactionResponse | undefined;
    for (let i = 0; i < 30; i++) {
      respAuth = await server.getTransaction(sentAuth.hash);
      if (respAuth.status !== 'NOT_FOUND') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(respAuth?.status).toBe('SUCCESS');

    // Verify authorized
    const checkTx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '1000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call('is_authorized', new Address(account.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const simCheck = await server.simulateTransaction(checkTx);
    const simCheckSuccess = simCheck as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    expect(scValToNative(simCheckSuccess.result!.retval)).toBe(true);

    // Revoke
    const revokeTx = new TransactionBuilder(
      await server.getAccount(admin.publicKey()),
      { fee: '10000000', networkPassphrase: PASSPHRASE }
    )
      .addOperation(
        contract.call('revoke', new Address(account.publicKey()).toScAddress())
      )
      .setTimeout(300)
      .build();

    const preparedRevoke = await server.prepareTransaction(revokeTx);
    preparedRevoke.sign(admin);
    await server.sendTransaction(preparedRevoke);
  });
});
