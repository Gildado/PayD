import axios from 'axios';
import { Keypair, Transaction, Networks, Utils } from '@stellar/stellar-sdk';
import { StellarService } from './stellarService.js';
import toml from 'toml';

export interface AnchorInfo {
  domain: string;
  webAuthEndpoint?: string;
  sep31Endpoint?: string;
  sep24Endpoint?: string;
  token?: string;
}

export class AnchorService {
  private static anchorCache: Record<string, AnchorInfo> = {};

  /**
   * Discovers anchor endpoints via SEP-1 (stellar.toml)
   */
  static async getAnchorInfo(domain: string): Promise<AnchorInfo> {
    if (this.anchorCache[domain]) {
      return this.anchorCache[domain];
    }

    try {
      const url = `https://${domain}/.well-known/stellar.toml`;
      const response = await axios.get(url);
      const parsedToml =
        typeof response.data === 'string'
          ? toml.parse(response.data)
          : (response.data as Record<string, string>);

      const webAuth = parsedToml.WEB_AUTH_ENDPOINT;
      const sep31 = parsedToml.TRANSFER_SERVER_SEP0031;
      const sep24 = parsedToml.TRANSFER_SERVER_SEP0024;

      this.anchorCache[domain] = {
        domain,
        webAuthEndpoint: webAuth,
        sep31Endpoint: sep31,
        sep24Endpoint: sep24,
      };

      return this.anchorCache[domain];
    } catch (error) {
      console.error(`Failed to fetch stellar.toml for ${domain}:`, error);
      throw new Error(`Anchor discovery failed for ${domain}`);
    }
  }

  /**
   * Performs SEP-10 authentication
   */
  static async authenticate(domain: string, clientKeypair: Keypair): Promise<string> {
    const info = await this.getAnchorInfo(domain);
    if (!info.webAuthEndpoint) throw new Error('Anchor does not support SEP-10');

    // 1. Get challenge
    const challengeResponse = await axios.get(info.webAuthEndpoint, {
      params: { account: clientKeypair.publicKey() },
    });

    const transaction = new Transaction(
      challengeResponse.data.transaction,
      challengeResponse.data.network_passphrase || StellarService.getNetworkPassphrase()
    );

    // 2. Sign challenge
    transaction.sign(clientKeypair);

    // 3. Submit signed challenge
    const tokenResponse = await axios.post(info.webAuthEndpoint, {
      transaction: transaction.toEnvelope().toXDR('base64'),
    });

    const token = tokenResponse.data.token;
    if (this.anchorCache[domain]) {
      this.anchorCache[domain].token = token;
    }
    return token;
  }

  /**
   * Fetches SEP-31 /info
   */
  static async getSEP31Info(domain: string): Promise<any> {
    const info = await this.getAnchorInfo(domain);
    if (!info.sep31Endpoint) throw new Error('Anchor does not support SEP-31');

    const response = await axios.get(`${info.sep31Endpoint}/info`);
    return response.data;
  }

  /**
   * Fetches SEP-24 /info
   */
  static async getSEP24Info(domain: string): Promise<any> {
    const info = await this.getAnchorInfo(domain);
    if (!info.sep24Endpoint) throw new Error('Anchor does not support SEP-24');

    const response = await axios.get(`${info.sep24Endpoint}/info`);
    return response.data;
  }

  /**
   * Initiates a cross-asset payment via SEP-31 /transactions
   */
  static async initiatePayment(domain: string, token: string, paymentData: any): Promise<any> {
    const info = await this.getAnchorInfo(domain);
    if (!info.sep31Endpoint) throw new Error('Anchor endpoint not found');

    const response = await axios.post(`${info.sep31Endpoint}/transactions`, paymentData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  /**
   * Gets specific SEP-31 transaction status
   */
  static async getTransaction(domain: string, token: string, id: string): Promise<any> {
    const info = await this.getAnchorInfo(domain);
    const response = await axios.get(`${info.sep31Endpoint}/transactions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Initiates a SEP-24 interactive withdrawal and returns the anchor redirect payload.
   */
  static async initiateSEP24Withdrawal(
    domain: string,
    token: string,
    withdrawalData: Record<string, string>
  ): Promise<any> {
    const info = await this.getAnchorInfo(domain);
    if (!info.sep24Endpoint) throw new Error('Anchor does not support SEP-24');

    const payload = new URLSearchParams(withdrawalData);
    const response = await axios.post(
      `${info.sep24Endpoint}/transactions/withdraw/interactive`,
      payload.toString(),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  }

  /**
   * Gets SEP-24 interactive transaction status.
   */
  static async getSEP24Transaction(domain: string, token: string, id: string): Promise<any> {
    const info = await this.getAnchorInfo(domain);
    if (!info.sep24Endpoint) throw new Error('Anchor does not support SEP-24');

    const response = await axios.get(`${info.sep24Endpoint}/transaction`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { id },
    });
    return response.data;
  }
}
