jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({ __esModule: true, default: {} }));
jest.mock('../../utils/tracing.js', () => ({ withSpan: jest.fn() }));
jest.mock('../../services/stellarService.js', () => ({
  StellarService: {
    getServer: jest.fn(),
    buildTransaction: jest.fn(),
    getNetworkPassphrase: () => 'Test SDF Network ; September 2015',
  },
}));

import { Account, Asset, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { StellarService } from '../../services/stellarService.js';
import { NotReadyError } from '../runtime.js';
import { StellarRewardGateway } from '../contributorRewardsWorkflow.js';
import { payer, recipient } from './fixtures.js';

beforeEach(() => jest.clearAllMocks());

test('the concrete adapter builds a native payment with an identifying memo and finite timeout', async () => {
  const builder = new TransactionBuilder(new Account(payer.publicKey(), '100'), {
    fee: '100',
    networkPassphrase: StellarService.getNetworkPassphrase(),
  })
    .addOperation(
      Operation.payment({
        destination: recipient.publicKey(),
        asset: Asset.native(),
        amount: '100',
      })
    )
    .setTimeout(300);
  (StellarService.buildTransaction as jest.Mock).mockResolvedValue(builder);
  const xdr = await new StellarRewardGateway().prepare(
    payer.publicKey(),
    recipient.publicKey(),
    '100.0000000',
    '3e811b6d-de98-44ef-8fbe-0e52ac324d9c'
  );
  const tx = TransactionBuilder.fromXDR(xdr, StellarService.getNetworkPassphrase());
  expect(tx.operations[0]).toMatchObject({
    type: 'payment',
    destination: recipient.publicKey(),
    amount: '100.0000000',
  });
  expect(StellarService.buildTransaction).toHaveBeenCalledWith(
    payer.publicKey(),
    [expect.anything()],
    expect.objectContaining({ timeout: 300, memo: expect.anything() })
  );
});

test('confirmation treats an indexing 404 as pending and propagates authorization failures', async () => {
  const call = jest
    .fn()
    .mockRejectedValueOnce({ response: { status: 404 } })
    .mockRejectedValueOnce({ response: { status: 403 } });
  (StellarService.getServer as jest.Mock).mockReturnValue({
    transactions: () => ({ transaction: () => ({ call }) }),
  });
  const gateway = new StellarRewardGateway();
  await expect(gateway.confirm('hash')).rejects.toBeInstanceOf(NotReadyError);
  await expect(gateway.confirm('hash')).rejects.toMatchObject({ response: { status: 403 } });
});

test('submission forwards the exact signed transaction instead of preparing another payment', async () => {
  const tx = new TransactionBuilder(new Account(payer.publicKey(), '100'), {
    fee: '100',
    networkPassphrase: StellarService.getNetworkPassphrase(),
  })
    .addOperation(
      Operation.payment({
        destination: recipient.publicKey(),
        asset: Asset.native(),
        amount: '100',
      })
    )
    .setTimeout(300)
    .build();
  tx.sign(payer);
  const submitTransaction = jest.fn().mockResolvedValue({ hash: tx.hash().toString('hex') });
  (StellarService.getServer as jest.Mock).mockReturnValue({ submitTransaction });
  await new StellarRewardGateway().submit(tx.toXDR());
  expect(submitTransaction.mock.calls[0][0].toXDR()).toBe(tx.toXDR());
  expect(StellarService.buildTransaction).not.toHaveBeenCalled();
});
