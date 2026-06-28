import axios from 'axios';
import { AnchorService } from '../anchorService.js';

const signMock = jest.fn();
const toXdrMock = jest.fn().mockReturnValue('signed-xdr');

jest.mock('axios');
jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {},
  Transaction: jest.fn().mockImplementation(() => ({
    sign: signMock,
    toEnvelope: () => ({
      toXDR: toXdrMock,
    }),
  })),
  Networks: {},
  Utils: {},
}));

describe('AnchorService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const keypair = {
    publicKey: () => 'GTESTACCOUNT',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('discovers SEP-24 and SEP-10 endpoints from stellar.toml', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: `
WEB_AUTH_ENDPOINT="https://anchor.example/auth"
TRANSFER_SERVER_SEP0031="https://anchor.example/sep31"
TRANSFER_SERVER_SEP0024="https://anchor.example/sep24"
      `,
    } as any);

    const info = await AnchorService.getAnchorInfo('anchor.example');

    expect(info.webAuthEndpoint).toBe('https://anchor.example/auth');
    expect(info.sep31Endpoint).toBe('https://anchor.example/sep31');
    expect(info.sep24Endpoint).toBe('https://anchor.example/sep24');
  });

  it('completes SEP-10 authentication and returns the bearer token', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: `
WEB_AUTH_ENDPOINT="https://anchor.example/auth"
TRANSFER_SERVER_SEP0024="https://anchor.example/sep24"
        `,
      } as any)
      .mockResolvedValueOnce({
        data: {
          transaction: 'challenge-xdr',
          network_passphrase: 'Test SDF Network ; September 2015',
        },
      } as any);
    mockedAxios.post.mockResolvedValueOnce({
      data: { token: 'sep10-token' },
    } as any);

    const token = await AnchorService.authenticate('anchor.example', keypair);

    expect(token).toBe('sep10-token');
    expect(signMock).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith('https://anchor.example/auth', {
      transaction: 'signed-xdr',
    });
  });

  it('starts a SEP-24 interactive withdrawal with form-encoded params', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: `
WEB_AUTH_ENDPOINT="https://anchor.example/auth"
TRANSFER_SERVER_SEP0024="https://anchor.example/sep24"
      `,
    } as any);
    mockedAxios.post.mockResolvedValueOnce({
      data: { id: 'tx-1', url: 'https://anchor.example/interactive/tx-1' },
    } as any);

    const result = await AnchorService.initiateSEP24Withdrawal('anchor.example', 'sep10-token', {
      asset_code: 'USD',
      account: 'GTESTACCOUNT',
      lang: 'en',
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://anchor.example/sep24/transactions/withdraw/interactive',
      expect.stringContaining('asset_code=USD'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sep10-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
    );
    expect(result.url).toContain('/interactive/tx-1');
  });
});
