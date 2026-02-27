import axios from "axios";

const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:3000/api";

export interface SEP31Transaction {
  id: string;
  status: string;
  amount_in: string;
  amount_out: string;
  asset_in: string;
  asset_out: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PaymentData {
  amount: string;
  asset_code: string;
  receiver_id: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface AnchorInfo {
  [key: string]: unknown;
}

export const anchorService = {
  getAnchorInfo: async (domain: string): Promise<AnchorInfo> => {
    const response = await axios.get(`${API_BASE_URL}/payments/anchor-info`, {
      params: { domain },
    });
    return response.data as AnchorInfo;
  },

  initiatePayment: async (
    domain: string,
    secretKey: string,
    paymentData: PaymentData,
  ): Promise<SEP31Transaction> => {
    const response = await axios.post(
      `${API_BASE_URL}/payments/sep31/initiate`,
      {
        domain,
        secretKey,
        paymentData,
      },
    );
    return response.data as SEP31Transaction;
  },

  getTransactionStatus: async (
    domain: string,
    id: string,
    secretKey: string,
  ): Promise<SEP31Transaction> => {
    const response = await axios.get(
      `${API_BASE_URL}/payments/sep31/status/${domain}/${id}`,
      {
        params: { secretKey },
      },
    );
    return response.data as SEP31Transaction;
  },
};
