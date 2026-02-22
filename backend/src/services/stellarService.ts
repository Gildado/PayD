import { Horizon, Networks } from "@stellar/stellar-sdk";

export class StellarService {
    private static server: Horizon.Server | null = null;
    private static network: string | null = null;

    static getServer(): Horizon.Server {
        if (!this.server) {
            const url = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
            this.server = new Horizon.Server(url);
        }
        return this.server;
    }

    static getNetworkPassphrase(): string {
        if (!this.network) {
            this.network = process.env.STELLAR_NETWORK === "public"
                ? Networks.PUBLIC
                : Networks.TESTNET;
        }
        return this.network;
    }
}
