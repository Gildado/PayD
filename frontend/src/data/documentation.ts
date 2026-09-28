export interface DocItem {
  id: string;
  question: string;
  answer: string;
  tags?: string[];
  relatedItems?: string[];
  category: string;
}

export interface DocCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  items: DocItem[];
}

export const documentationCategories: DocCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the basics of PayD and set up your account',
    icon: 'Rocket',
    items: [
      {
        id: 'gs-1',
        question: 'How do I create a PayD account?',
        answer: `To create a PayD account:

1. Click the "Connect Wallet" button in the top right corner
2. Select your preferred Stellar wallet (Freighter, xBull, or Lobstr)
3. Approve the connection request in your wallet
4. Your account will be automatically created and linked to your Stellar address

No additional registration is required - your Stellar wallet serves as your identity.`,
        tags: ['account', 'wallet', 'setup'],
        category: 'getting-started',
      },
      {
        id: 'gs-2',
        question: 'What wallets are supported?',
        answer: `PayD supports the following Stellar wallets:

- **Freighter**: The most popular Stellar wallet, perfect for beginners
- **xBull**: A mobile-first wallet with great UX
- **Lobstr**: Feature-rich wallet with built-in DEX access

We recommend Freighter for most users due to its seamless browser integration and active development.`,
        tags: ['wallet', 'freighter', 'xbull', 'lobstr'],
        category: 'getting-started',
      },
      {
        id: 'gs-3',
        question: 'How do I navigate the dashboard?',
        answer: `The PayD dashboard is organized into key sections:

- **Payroll**: Schedule and manage payroll distributions
- **Employees**: Add and manage employee records
- **Reports**: Generate custom payroll reports
- **Transactions**: View transaction history
- **Cross-Asset**: Make payments across different assets
- **Revenue Split**: Configure revenue sharing

Use the navigation bar at the top to switch between sections. The help link in the navigation provides context-specific assistance.`,
        tags: ['navigation', 'dashboard', 'ui'],
        category: 'getting-started',
      },
    ],
  },
  {
    id: 'stellar-concepts',
    name: 'Stellar Concepts',
    description: 'Understand key Stellar network concepts',
    icon: 'Globe',
    items: [
      {
        id: 'sc-1',
        question: 'What is a trustline?',
        answer: `A **trustline** is a configuration on your Stellar account that allows you to hold a specific asset issued by another account.

**Key points:**
- Trustlines are required to receive non-native assets (anything other than XLM)
- Each trustline has a limit on how much of that asset you're willing to hold
- Setting up a trustline costs 0.5 XLM (which is held in reserve)
- You can remove trustlines if you no longer hold that asset

**In PayD context:**
Employees need to establish trustlines for the assets they'll receive as payment (e.g., USDC). PayD will guide you through this process when setting up payroll.`,
        tags: ['trustline', 'assets', 'tokens', 'xlm'],
        relatedItems: ['sc-2', 'sc-3'],
        category: 'stellar-concepts',
      },
      {
        id: 'sc-2',
        question: 'What is an anchor?',
        answer: `An **anchor** is a regulated financial institution that bridges traditional banking systems with the Stellar network.

**Anchors provide:**
- Fiat on/off ramps (deposit/withdraw cash)
- Regulated stablecoins (like USDC on Stellar)
- KYC/AML compliance
- Regulatory oversight

**Popular anchors on Stellar:**
- **Circle**: Issues USDC on Stellar
- **MoneyGram**: Cash in/out locations worldwide
- **Stellar Term**: DEX with anchor integration

**In PayD context:**
PayD integrates with anchors to provide stablecoin payroll options, allowing employees to receive payments in assets backed by fiat currencies.`,
        tags: ['anchor', 'fiat', 'usdc', 'banking'],
        relatedItems: ['sc-1', 'sc-4'],
        category: 'stellar-concepts',
      },
      {
        id: 'sc-3',
        question: 'What are claimable balances?',
        answer: `**Claimable balances** are a Stellar feature that allows sending payments to accounts that don't yet have a trustline for the asset.

**How they work:**
1. Sender creates a claimable balance with specific claim conditions
2. Recipient can claim the balance once they set up the required trustline
3. Claims can have time-based or predicate-based conditions

**Benefits for payroll:**
- Pay employees even if they haven't set up trustlines yet
- Schedule payments with future claim dates
- Provide clear instructions for employees to claim their funds

PayD uses claimable balances for seamless cross-asset payments.`,
        tags: ['claimable-balances', 'payments', 'claim'],
        category: 'stellar-concepts',
      },
      {
        id: 'sc-4',
        question: 'What is Soroban?',
        answer: `**Soroban** is Stellar's smart contract platform, enabling programmable transactions and complex business logic.

**Key features:**
- Turing-complete smart contracts
- Predictable gas fees
- State archival for cost efficiency
- Built-in oracle support

**In PayD context:**
PayD leverages Soroban contracts for:
- Automated payroll scheduling
- Multi-signature payment authorization
- Revenue splitting logic
- Custom payment conditions

The smart contracts handle complex payroll scenarios that wouldn't be possible with basic transactions.`,
        tags: ['soroban', 'smart-contracts', 'automation'],
        category: 'stellar-concepts',
      },
      {
        id: 'sc-5',
        question: 'What is the minimum XLM balance?',
        answer: `Every Stellar account must maintain a **minimum balance of XLM** as reserve.

**Current requirements:**
- Base reserve: 0.5 XLM
- Each trustline: +0.5 XLM
- Each offer/signer: +0.5 XLM

**Example calculation:**
A new account with 2 trustlines needs:
- 2 XLM base (increased from 1 XLM in recent protocol updates)
- +1 XLM for 2 trustlines
- **Total: 3 XLM minimum**

**Important:**
You cannot spend below your minimum reserve. Ensure your account has sufficient XLM for operations plus reserves.`,
        tags: ['xlm', 'balance', 'reserve', 'minimum'],
        category: 'stellar-concepts',
      },
    ],
  },
  {
    id: 'payroll',
    name: 'Payroll Management',
    description: 'Managing employee payments and scheduling',
    icon: 'Wallet',
    items: [
      {
        id: 'pay-1',
        question: 'How do I add an employee?',
        answer: `To add an employee to PayD:

1. Navigate to the **Employees** page from the main navigation
2. Click the **Add Employee** button
3. Fill in the required details:
   - Employee name
   - Stellar wallet address (public key starting with 'G')
   - Payment amount
   - Payment frequency
   - Payment asset (e.g., USDC, XLM)
4. Click **Save** to add the employee

The employee will appear in your employee list and can be included in payroll runs.`,
        tags: ['employee', 'add', 'setup'],
        category: 'payroll',
      },
      {
        id: 'pay-2',
        question: 'How do I schedule a payroll run?',
        answer: `To schedule a payroll run:

1. Go to the **Payroll** page
2. Click **Schedule Payroll** or use the scheduling wizard
3. Select the employees to include
4. Choose the payment frequency:
   - Weekly
   - Bi-weekly
   - Monthly
5. Set the start date and time
6. Review and confirm the schedule

The system will automatically execute payments according to your schedule. You can view upcoming runs and their status in the payroll dashboard.`,
        tags: ['schedule', 'automation', 'frequency'],
        category: 'payroll',
      },
      {
        id: 'pay-3',
        question: 'What payment assets are supported?',
        answer: `PayD supports various payment assets on the Stellar network:

**Native:**
- XLM (Stellar Lumens) - always supported

**Stablecoins:**
- USDC (via Circle anchor)
- Other Stellar-based stablecoins

**Custom Assets:**
- Any asset with an established trustline
- Company-issued tokens

**Note:** Employees must have appropriate trustlines to receive non-XLM payments. PayD will guide employees through trustline setup when claiming payments.`,
        tags: ['assets', 'xlm', 'usdc', 'tokens'],
        category: 'payroll',
      },
      {
        id: 'pay-4',
        question: 'How do I cancel a scheduled payment?',
        answer: `To cancel a scheduled payment:

1. Navigate to the **Payroll** page
2. Find the scheduled payment in the "Pending Claims" section
3. Click the **Cancel** button next to the payment
4. Confirm the cancellation

**Important notes:**
- Cancellations are only possible before the payment is broadcast to the network
- Once broadcast, transactions cannot be reversed
- Cancelled payments free up any reserved funds immediately

If a payment has already been broadcast but not yet claimed, the employee can still claim it. Contact support for urgent issues.`,
        tags: ['cancel', 'scheduled', 'pending'],
        category: 'payroll',
      },
    ],
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting',
    description: 'Solutions to common issues',
    icon: 'AlertCircle',
    items: [
      {
        id: 'ts-1',
        question: 'Payroll transaction failed to send',
        answer: `If your payroll transaction failed, check these common causes:

**1. Insufficient Balance**
- Verify you have enough of the payment asset
- Ensure you have XLM for transaction fees (0.00001 XLM per operation)
- Check that you're above minimum XLM reserve

**2. Missing Trustline**
- Ensure your account has the required trustline for the asset
- If paying in USDC, verify both sender and receiver have USDC trustlines

**3. Invalid Sequence Number**
- Wait a few seconds and retry (network congestion)
- Check for pending transactions in your wallet

**4. Wallet Connection Issues**
- Reconnect your wallet
- Clear browser cache and reload

If issues persist, check the transaction simulation panel for specific error details.`,
        tags: ['failed', 'transaction', 'error'],
        category: 'troubleshooting',
      },
      {
        id: 'ts-2',
        question: 'Employee not receiving payments',
        answer: `If an employee isn't receiving payments:

**1. Verify Stellar Address**
- Confirm the address starts with 'G' (public key)
- Check for typos or formatting issues
- Test with a small amount first

**2. Check Trustlines**
- Employee must have trustline for non-XLM assets
- Use claimable balances if trustline isn't set up
- Guide employee through trustline setup

**3. Verify Account Status**
- Employee account must be funded (minimum 1 XLM)
- Account must not be frozen or locked

**4. Check Payment Status**
- View transaction history in the Transactions page
- Look for "pending" or "failed" statuses
- Contact support with transaction IDs for investigation

**Employee claiming steps:**
1. Open their Stellar wallet
2. Navigate to claimable balances
3. Accept the pending balance
4. Set up trustline if prompted`,
        tags: ['employee', 'receiving', 'trustline'],
        category: 'troubleshooting',
      },
      {
        id: 'ts-3',
        question: 'Wallet connection issues',
        answer: `If you're having trouble connecting your wallet:

**Freighter:**
- Ensure Freighter extension is installed and enabled
- Check that you're logged into Freighter
- Try refreshing the page and reconnecting
- Verify you're on the correct network (Mainnet/Testnet)
- If the approval prompt does not appear within 15 seconds, PayD will show a timeout error so you can retry safely

**xBull:**
- Make sure xBull mobile app is installed
- Check that the app is open and ready to receive requests
- Try scanning the connection QR code again

**Lobstr:**
- Verify Lobstr extension/app is active
- Ensure you've approved the connection request
- If the approval prompt stalls for more than 15 seconds, close the request, reopen the wallet, and try again

**General fixes:**
- Clear browser cache and cookies
- Disable other wallet extensions temporarily
- Try a different browser (Chrome/Firefox recommended)
- Check for browser extension updates`,
        tags: ['wallet', 'connection', 'freighter', 'xbull'],
        category: 'troubleshooting',
      },
      {
        id: 'ts-4',
        question: 'Transaction simulation errors',
        answer: `Transaction simulation catches errors before broadcasting:

**Common simulation errors:**

**"insufficient funds"**
- Add more XLM or payment asset to your account
- Account for minimum reserves and fees

**"no trustline"**
- Set up the required trustline before sending
- Or use claimable balances for the recipient

**"op_underfunded"**
- Transaction fee amount unavailable
- Add XLM for network fees

**"op_malformed"**
- Invalid asset code or issuer
- Verify asset details in transaction

**How to fix:**
1. Read the error message in the Transaction Simulation Panel
2. Address the specific issue mentioned
3. Click "Reset" and try again with corrected parameters
4. Simulation must pass before broadcast is enabled`,
        tags: ['simulation', 'error', 'validation'],
        category: 'troubleshooting',
      },
      {
        id: 'ts-5',
        question: 'How to recover unsaved changes',
        answer: `PayD automatically saves your form changes:

**Autosave feature:**
- Form data is saved to local storage automatically
- Look for the "Saving..." indicator near form fields
- "Last saved" timestamp shows when data was persisted

**To recover:**
1. Refresh the page if you accidentally closed it
2. Your data should automatically restore
3. Check the notification for "Recovered unsaved draft"

**If data is missing:**
- Check browser local storage isn't cleared
- Ensure you're on the same browser/device
- Check if you were in incognito/private mode

**Best practices:**
- Don't clear browser data while working
- Complete and submit forms in one session when possible
- Export important reports for backup`,
        tags: ['autosave', 'recovery', 'draft'],
        category: 'troubleshooting',
      },
    ],
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Keeping your account and funds safe',
    icon: 'Shield',
    items: [
      {
        id: 'sec-1',
        question: 'How does PayD protect my funds?',
        answer: `PayD implements multiple security layers:

**Non-Custodial Design:**
- PayD never holds your private keys
- All transactions require your wallet signature
- You maintain full control of your funds

**Transaction Simulation:**
- All operations are simulated before broadcast
- Preview exact outcomes before signing
- Catch errors without risking funds

**Smart Contract Security:**
- Audited Soroban contracts
- Multi-signature options available
- Time-locked operations for large payments

**Account Security:**
- Wallet-based authentication (no passwords to steal)
- Optional 2FA through wallet apps
- Session timeouts for inactive users

**Best practices:**
- Keep your wallet seed phrase secure
- Verify transaction details before signing
- Use hardware wallets for large amounts`,
        tags: ['security', 'funds', 'protection'],
        category: 'security',
      },
      {
        id: 'sec-2',
        question: 'What if I lose my wallet?',
        answer: `If you lose access to your wallet:

**Recovery options:**

**1. Seed Phrase Recovery**
- Use your 12-24 word recovery phrase
- Import into any compatible Stellar wallet
- All accounts and assets will restore

**2. Hardware Wallet Recovery**
- If you used a hardware wallet (Ledger, Trezor)
- Connect device and restore accounts
- Your funds remain secure

**Important:**
- PayD cannot recover your wallet or funds
- We have no access to your private keys
- Always backup your seed phrase securely

**Prevention:**
- Write seed phrase on paper (not digitally)
- Store in multiple secure locations
- Consider metal backup for fire/water resistance
- Never share your seed phrase with anyone`,
        tags: ['wallet', 'recovery', 'backup', 'seed'],
        category: 'security',
      },
      {
        id: 'sec-3',
        question: 'Best practices for account security',
        answer: `Follow these security best practices:

**Wallet Security:**
- Use a hardware wallet for large amounts
- Enable all security features in your wallet app
- Never share your seed phrase or private key
- Verify transaction details before signing

**Device Security:**
- Keep your browser and OS updated
- Use reputable antivirus software
- Avoid public WiFi for sensitive operations
- Enable device encryption

**Account Management:**
- Use separate wallets for different purposes
- Set up multi-signature for team accounts
- Regular transaction monitoring
- Enable transaction notifications

**Operational Security:**
- Verify recipient addresses carefully
- Test with small amounts first
- Keep records of all transactions
- Report suspicious activity immediately`,
        tags: ['security', 'best-practices', 'protection'],
        category: 'security',
      },
    ],
  },
  {
    id: 'contributor-rewards',
    name: 'Contributor Rewards',
    description: 'Learn how to earn rewards for contributing to PayD',
    icon: 'Trophy',
    items: [
      {
        id: 'cr-1',
        question: 'How can I earn rewards as a contributor?',
        answer: `Open-source contributors can earn rewards by solving high-priority issues:
        
1. Find an issue with the **reward-eligible** label on GitHub
2. Express interest and get assigned to the issue
3. Submit a high-quality PR with tests and documentation
4. Once merged, you are eligible for the reward in XLM or USDC
        
Visit our [Rewards Program](/rewards) page for a full breakdown of reward tiers and requirements.`,
        tags: ['contribute', 'rewards', 'bounties', 'stellar'],
        category: 'contributor-rewards',
      },
      {
        id: 'cr-2',
        question: 'What are the reward tiers?',
        answer: `We offer three main reward tiers based on issue complexity:
        
- **Minor (100 XLM)**: Bug fixes, documentation, small UI changes
- **Major (500 XLM)**: New features, complex bug fixes, optimizations
- **Critical (2000 XLM)**: Security fixes, core protocol changes
        
The exact reward for an issue is explicitly stated in its GitHub description.`,
        tags: ['tiers', 'amount', 'xlm', 'usdc'],
        category: 'contributor-rewards',
      },
      {
        id: 'cr-3',
        question: 'How are rewards paid out?',
        answer: `Rewards are paid out directly to your Stellar wallet. 
        
Once your PR is merged, provide your Stellar address to the maintainers. Payment is processed via our automated payroll engine and typically arrives within 24 hours of approval.`,
        tags: ['payment', 'stellar', 'wallet', 'speed'],
        category: 'contributor-rewards',
      },
    ],
  },
];

export function searchDocumentation(query: string): DocItem[] {
  const lowerQuery = query.toLowerCase();
  const results: DocItem[] = [];

  for (const category of documentationCategories) {
    for (const item of category.items) {
      if (
        item.question.toLowerCase().includes(lowerQuery) ||
        item.answer.toLowerCase().includes(lowerQuery) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
      ) {
        results.push(item);
      }
    }
  }

  return results;
}

export function getDocItemById(id: string): DocItem | undefined {
  for (const category of documentationCategories) {
    const item = category.items.find((i) => i.id === id);
    if (item) return item;
  }
  return undefined;
}

export function getRelatedItems(item: DocItem): DocItem[] {
  if (!item.relatedItems) return [];
  return item.relatedItems
    .map((id) => getDocItemById(id))
    .filter((i): i is DocItem => i !== undefined);
}
