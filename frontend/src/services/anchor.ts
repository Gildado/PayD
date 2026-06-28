import axiosInstance from '../api/axiosInstance';
import { Keypair } from '@stellar/stellar-sdk';

const API_ORIGIN = ((import.meta.env.VITE_API_URL as string | undefined) || '').replace(/\/+$/, '');
/** Use v1 API; relative `/api/v1` works with Vite dev proxy. */
const API_V1 = API_ORIGIN ? `${API_ORIGIN}/api/v1` : '/api/v1';

export interface SEP31Transaction {
  id: string;
  status: string;
  amount_in: string;
  amount_out: string;
  asset_in: string;
  asset_out: string;
}

export const anchorService = {
  getAnchorInfo: async (domain: string) => {
    const response = await axiosInstance.get<{ info: Record<string, unknown> }>(
      `${API_V1}/payments/anchor-info`,
      {
        params: { domain },
      }
    );
    return response.data;
  },

  initiatePayment: async (
    domain: string,
    secretKey: string,
    paymentData: { amount: string; asset_code: string; receiver_id: string },
    opts?: { twoFactorToken?: string }
  ) => {
    const senderPublicKey = Keypair.fromSecret(secretKey).publicKey();
    const headers: Record<string, string> = {};
    if (opts?.twoFactorToken) {
      headers['x-2fa-token'] = opts.twoFactorToken;
    }
    const response = await axiosInstance.post<{ id: string }>(
      `${API_V1}/payments/sep31/initiate`,
      {
        domain,
        secretKey,
        senderPublicKey,
        paymentData,
      },
      { headers }
    );
    return response.data;
  },

  getTransactionStatus: async (domain: string, id: string, secretKey: string) => {
    const response = await axiosInstance.get<SEP31Transaction>(
      `${API_V1}/payments/sep31/status/${encodeURIComponent(domain)}/${encodeURIComponent(id)}`,
      {
        params: { secretKey },
      }
    );
    return response.data;
  },
};
