/**
 * ORGUSD Asset Issuance Script for Stellar Testnet
 *
 * Creates issuer and distribution accounts, funds them via Friendbot,
 * configures authorization flags, and issues the ORGUSD custom asset.
 *
 * Usage:
 *   npx tsx backend/scripts/issue-orgusd.ts
 *
 * Environment variables (optional overrides):
 *   STELLAR_HORIZON_URL  - Horizon server URL (default: testnet)
 *   ORGUSD_ISSUE_AMOUNT  - Amount to issue (default: 1000000)
 */

import {
  Keypair,
  Horizon,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  AuthRequiredFlag,
  AuthRevocableFlag,
} from "@stellar/stellar-sdk";
import * as fs from "fs";
import * as path from "path";

const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const ISSUE_AMOUNT = process.env.ORGUSD_ISSUE_AMOUNT || "1000000";

const server = new Horizon.Server(HORIZON_URL);

async function fundAccount(publicKey: string): Promise<void> {
  const url = `${FRIENDBOT_URL}?addr=${publicKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Friendbot funding failed for ${publicKey}: ${body}`);
  }
  console.log(`  Funded account ${publicKey}`);
}

async function main(): Promise<void> {
  console.log("=== ORGUSD Asset Issuance on Stellar Testnet ===\n");

  // 1. Generate keypairs
  console.log("1. Generating keypairs...");
  const issuerKeypair = Keypair.random();
  const distributionKeypair = Keypair.random();

  console.log(`  Issuer Public Key:       ${issuerKeypair.publicKey()}`);
  console.log(`  Distribution Public Key:  ${distributionKeypair.publicKey()}`);

  // 2. Fund accounts via Friendbot
  console.log("\n2. Funding accounts via Friendbot...");
  await fundAccount(issuerKeypair.publicKey());
  await fundAccount(distributionKeypair.publicKey());

  // 3. Set authorization flags on the Issuer account
  console.log("\n3. Setting authorization flags on Issuer account...");
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  const setFlagsTx = new TransactionBuilder(issuerAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.setOptions({
        setFlags: (AuthRequiredFlag | AuthRevocableFlag) as number,
      })
    )
    .setTimeout(30)
    .build();

  setFlagsTx.sign(issuerKeypair);
  await server.submitTransaction(setFlagsTx);
  console.log("  Set auth_required and auth_revocable flags on Issuer");

  // 4. Verify flags on issuer
  const updatedIssuer = await server.loadAccount(issuerKeypair.publicKey());
  console.log(
    `  Issuer flags: auth_required=${updatedIssuer.flags.auth_required}, auth_revocable=${updatedIssuer.flags.auth_revocable}`
  );

  // 5. Establish trustline from Distribution to Issuer for ORGUSD
  console.log("\n4. Establishing ORGUSD trustline from Distribution account...");
  const orgUsdAsset = new Asset("ORGUSD", issuerKeypair.publicKey());

  const distributionAccount = await server.loadAccount(
    distributionKeypair.publicKey()
  );
  const trustlineTx = new TransactionBuilder(distributionAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: orgUsdAsset,
      })
    )
    .setTimeout(30)
    .build();

  trustlineTx.sign(distributionKeypair);
  await server.submitTransaction(trustlineTx);
  console.log("  Trustline established");

  // 6. Authorize the Distribution account to hold ORGUSD (required because auth_required is set)
  console.log("\n5. Authorizing Distribution account to hold ORGUSD...");
  const reloadedIssuer = await server.loadAccount(issuerKeypair.publicKey());
  const authorizeTx = new TransactionBuilder(reloadedIssuer, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.setTrustLineFlags({
        trustor: distributionKeypair.publicKey(),
        asset: orgUsdAsset,
        flags: {
          authorized: true,
          authorizedToMaintainLiabilities: false,
        },
      })
    )
    .setTimeout(30)
    .build();

  authorizeTx.sign(issuerKeypair);
  await server.submitTransaction(authorizeTx);
  console.log("  Distribution account authorized");

  // 7. Issue ORGUSD from Issuer to Distribution
  console.log(
    `\n6. Issuing ${ISSUE_AMOUNT} ORGUSD to Distribution account...`
  );
  const issuerForPayment = await server.loadAccount(issuerKeypair.publicKey());
  const issueTx = new TransactionBuilder(issuerForPayment, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: distributionKeypair.publicKey(),
        asset: orgUsdAsset,
        amount: ISSUE_AMOUNT,
      })
    )
    .setTimeout(30)
    .build();

  issueTx.sign(issuerKeypair);
  const issueResult = await server.submitTransaction(issueTx);
  console.log(`  Issued successfully! TX hash: ${issueResult.hash}`);

  // 8. Verify Distribution account balance
  const finalDistribution = await server.loadAccount(
    distributionKeypair.publicKey()
  );
  const orgUsdBalance = finalDistribution.balances.find(
    (b: any) => b.asset_code === "ORGUSD"
  );
  console.log(
    `\n  Distribution ORGUSD balance: ${orgUsdBalance ? orgUsdBalance.balance : "NOT FOUND"}`
  );

  // 9. Save keypair information to file (TESTNET ONLY - secrets in plaintext)
  const outputDir = path.resolve(__dirname, "../../.keys");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const keypairData = {
    network: "testnet",
    asset_code: "ORGUSD",
    created_at: new Date().toISOString(),
    issuer: {
      public_key: issuerKeypair.publicKey(),
      secret_key: issuerKeypair.secret(),
    },
    distribution: {
      public_key: distributionKeypair.publicKey(),
      secret_key: distributionKeypair.secret(),
    },
    flags: {
      auth_required: true,
      auth_revocable: true,
    },
    initial_supply: ISSUE_AMOUNT,
    transaction_hash: issueResult.hash,
  };

  const outputPath = path.join(outputDir, "orgusd-testnet-keypairs.json");
  fs.writeFileSync(outputPath, JSON.stringify(keypairData, null, 2));
  console.log(`\n7. Keypair data saved to ${outputPath}`);

  // Summary
  console.log("\n=== ORGUSD Issuance Complete ===");
  console.log(`  Asset Code:        ORGUSD`);
  console.log(`  Issuer:            ${issuerKeypair.publicKey()}`);
  console.log(`  Distribution:      ${distributionKeypair.publicKey()}`);
  console.log(`  Initial Supply:    ${ISSUE_AMOUNT}`);
  console.log(`  Auth Required:     true`);
  console.log(`  Auth Revocable:    true`);
  console.log(`  Network:           Stellar Testnet`);
  console.log(`  TX Hash:           ${issueResult.hash}`);
  console.log(
    `\n  WARNING: The keypair file at ${outputPath} contains secret keys.`
  );
  console.log(`  Never commit this file to version control.`);
}

main().catch((err) => {
  console.error("\nFailed to issue ORGUSD:", err);
  process.exit(1);
});
