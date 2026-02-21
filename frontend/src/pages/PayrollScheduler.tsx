import React, { useEffect, useState } from "react";
import { AutosaveIndicator } from "../components/AutosaveIndicator";
import { useAutosave } from "../hooks/useAutosave";
import { useTransactionSimulation } from "../hooks/useTransactionSimulation";
import { TransactionSimulationPanel } from "../components/TransactionSimulationPanel";
import { useNotification } from "../providers/NotificationProvider";
import { createClaimableBalanceTransaction, generateWallet } from "../services/stellar";
import {
  Button,
  Card,
  Input,
  Select,
  Alert,
} from "@stellar/design-system";

interface PayrollFormState {
    employeeName: string;
    amount: string;
    frequency: "weekly" | "monthly";
    startDate: string;
    memo?: string;
}

// const initialFormState: PayrollFormState = {
//     employeeName: "",
//     amount: "",
//     frequency: "monthly",
//     startDate: "",
//     memo: "",
// };

// export default function PayrollScheduler() {
//     const { notify } = useNotification();
//     const [formData, setFormData] = useState<PayrollFormState>(initialFormState);
//     const [isBroadcasting, setIsBroadcasting] = useState(false);

interface PendingClaim {
  id: string;
  employeeName: string;
  amount: string;
  dateScheduled: string;
  claimantPublicKey: string;
  status: string;
}

// Mock employer secret key for simulation purposes
const MOCK_EMPLOYER_SECRET =
  "SD3X5K7G7XV4K5V3M2G5QXH434M3VX6O5P3QVQO3L2PQSQQQQQQQQQQQ";

interface PayrollFormState {
  employeeName: string;
  amount: string;
  frequency: "weekly" | "monthly";
  startDate: string;
}

const initialFormState: PayrollFormState = {
  employeeName: "",
  amount: "",
  frequency: "monthly",
  startDate: "",
};

export default function PayrollScheduler() {
  const [formData, setFormData] = useState<PayrollFormState>(initialFormState);
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>(() => {
    const saved = localStorage.getItem("pending-claims");
    if (saved) {
      const parsed = JSON.parse(saved) as unknown;
      return parsed as PendingClaim[];
    }
    return [];
  });
  const [txResult, setTxResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Use the autosave hook
  const { saving, lastSaved, loadSavedData } = useAutosave<PayrollFormState>(
    "payroll-scheduler-draft",
    formData
  );

  // Load saved data on mount
  useEffect(() => {
    const saved = loadSavedData();
    if (saved) {
      setFormData(saved);
    }
  }, [loadSavedData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Assume employee's wallet address would be looked up by name or stored.
    // Since we are mocking, we will just generate a random recipient for the claim test
    // if we don't know it, or we could prompt for it.
    // In a real flow, employeeName would map to their database record -> walletAddress.
    const mockRecipientPublicKey = generateWallet().publicKey;

    const result = createClaimableBalanceTransaction(
      MOCK_EMPLOYER_SECRET,
      mockRecipientPublicKey,
      String(formData.amount),
      "USDC"
    );

    const {
        simulate,
        resetSimulation,
        isSimulating,
        result: simulationResult,
        error: simulationProcessError,
        isSuccess: simulationPassed
    } = useTransactionSimulation();

    useEffect(() => {
        const saved = loadSavedData();
        if (saved) {
            setFormData(saved);
        }
    }, [loadSavedData]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Reset simulation if form changes
        if (simulationResult) resetSimulation();
    };

    /**
     * Step 1: Initialize & Simulate
     */
    const handleInitialize = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.employeeName || !formData.amount) {
            notify("Please fill in all required fields.");
            return;
        }

        // Mock XDR for simulation demonstration
        // In a real app, this would be built using the Stellar SDK from formData
        const mockXdr = "AAAAAgAAAABmF8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

        await simulate({ envelopeXdr: mockXdr });
    };

    /**
     * Step 2: Final Broadcast (only available if simulation passes)
     */
    const handleBroadcast = async () => {
        setIsBroadcasting(true);
        try {
            // Simulate a brief delay for network broadcast
            await new Promise(resolve => setTimeout(resolve, 1500));
            notify("Payroll stream successfully broadcasted to Stellar network!");
            resetSimulation();
            setFormData(initialFormState);
        } catch (err) {
            notify("Broadcast failed. Please check your connection.");
        } finally {
            setIsBroadcasting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-4xl mx-auto w-full">
            <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
                <div>
                    <h1 className="text-4xl font-black mb-2 tracking-tight">Payroll <span className="text-accent">Scheduler</span></h1>
                    <p className="text-muted font-mono text-sm tracking-wider uppercase">Automated distribution engine</p>
                </div>
                <AutosaveIndicator saving={saving} lastSaved={lastSaved} />
            </div>

            <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-3">
                    <form onSubmit={handleInitialize} className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 card glass noise">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Employee Name
                            </label>
                            <input
                                type="text"
                                name="employeeName"
                                value={formData.employeeName}
                                onChange={handleChange}
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-medium"
                                placeholder="e.g. Satoshi Nakamoto"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Amount (USD equivalent)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-mono">$</span>
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    className="w-full bg-black/20 border border-hi rounded-xl p-4 pl-8 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Distribution Frequency
                            </label>
                            <select
                                name="frequency"
                                value={formData.frequency}
                                onChange={handleChange}
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all appearance-none cursor-pointer"
                            >
                                <option value="weekly" className="bg-surface">Weekly</option>
                                <option value="monthly" className="bg-surface">Monthly</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Commencement Date
                            </label>
                            <input
                                type="date"
                                name="startDate"
                                value={formData.startDate}
                                onChange={handleChange}
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Transaction Memo (Optional)
                            </label>
                            <textarea
                                name="memo"
                                value={formData.memo}
                                onChange={handleChange}
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-medium resize-none h-24"
                                placeholder="e.g. Feb 2026 Salary"
                            />
                        </div>

                        <div className="md:col-span-2 pt-4">
                            {!simulationPassed ? (
                                <button
                                    type="submit"
                                    disabled={isSimulating}
                                    className="w-full py-4 bg-accent text-bg font-black rounded-xl hover:scale-[1.01] transition-transform shadow-lg shadow-accent/10 uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                                >
                                    {isSimulating ? "Simulating..." : "Initialize and Validate"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleBroadcast}
                                    disabled={isBroadcasting}
                                    className="w-full py-4 bg-success text-bg font-black rounded-xl hover:scale-[1.01] transition-transform shadow-lg shadow-success/10 uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                                >
                                    {isBroadcasting ? "Broadcasting..." : "Confirm & Broadcast to Network"}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Simulation & Info Side Panel */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <TransactionSimulationPanel
                        result={simulationResult}
                        isSimulating={isSimulating}
                        processError={simulationProcessError}
                        onReset={resetSimulation}
                    />

                    <div className="card glass noise h-fit">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            Pre-flight Validation
                        </h3>
                        <p className="text-xs text-muted leading-relaxed mb-4">
                            All transactions are simulated via Stellar Horizon before submission. This catches common errors like:
                        </p>
                        <ul className="text-xs text-muted space-y-2 list-disc pl-4 font-medium">
                            <li>Insufficient XLM balance for fees</li>
                            <li>Invalid sequence numbers</li>
                            <li>Missing trustlines for tokens</li>
                            <li>Account eligibility status</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
    if (result.success) {
      const newClaim: PendingClaim = {
        id: Math.random().toString(36).substr(2, 9),
        employeeName: formData.employeeName,
        amount: formData.amount,
        dateScheduled:
          formData.startDate || new Date().toISOString().split("T")[0],
        claimantPublicKey: mockRecipientPublicKey,
        status: "Pending Claim",
      };
      const updatedClaims = [...pendingClaims, newClaim];
      setPendingClaims(updatedClaims);
      localStorage.setItem("pending-claims", JSON.stringify(updatedClaims));

      setTxResult({
        success: true,
        message: `Claimable balance of ${formData.amount} USDC created for ${formData.employeeName}.`,
      });

      setFormData({ ...initialFormState });
    } else {
      setTxResult({
        success: false,
        message: "Failed to create claimable balance.",
      });
    }
  };

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "2rem auto",
        padding: "0 1rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
        gap: "2rem",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h1 style={{ fontWeight: "bold", fontSize: "1.5rem" }}>
            Payroll Scheduler
          </h1>
          <AutosaveIndicator saving={saving} lastSaved={lastSaved} />
        </div>

        {txResult && (
          <div style={{ marginBottom: "1.5rem" }}>
            <Alert
              variant={txResult.success ? "success" : "error"}
              title={txResult.success ? "Success" : "Error"}
              placement="inline"
            >
              {txResult.message}
            </Alert>
          </div>
        )}

        <Card>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            <Input
              id="employeeName"
              fieldSize="md"
              label="Employee Name"
              name="employeeName"
              value={formData.employeeName}
              onChange={handleChange}
              placeholder="John Doe"
            />

            <Input
              id="amount"
              fieldSize="md"
              label="Amount (USD)"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="5000"
            />

            <Select
              id="frequency"
              fieldSize="md"
              label="Frequency"
              value={formData.frequency}
              onChange={(e) => handleSelectChange("frequency", e.target.value)}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>

            <Input
              id="startDate"
              fieldSize="md"
              label="Start Date (YYYY-MM-DD)"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              placeholder="2024-01-01"
            />

            <Button id="tour-init-payroll" type="submit" variant="primary" size="md">
              Schedule Payroll
            </Button>
          </form>
        </Card>
      </div>

      <div>
        <h2
          style={{
            fontWeight: "bold",
            fontSize: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          Pending Claims
        </h2>
        <Card>
          {pendingClaims.length === 0 ? (
            <p style={{ color: "var(--color-gray-500)", margin: 0 }}>
              No pending claimable balances.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {pendingClaims.map((claim) => (
                <li
                  key={claim.id}
                  style={{
                    border: "1px solid var(--color-gray-300)",
                    padding: "1rem",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <h3 style={{ fontWeight: "500", margin: 0 }}>
                      {claim.employeeName}
                    </h3>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0.125rem 0.625rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: "500",
                        backgroundColor: "var(--color-yellow-100)",
                        color: "var(--color-yellow-800)",
                      }}
                    >
                      {claim.status}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--color-gray-600)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      Amount: {claim.amount} USDC
                    </p>
                    <p style={{ margin: 0 }}>
                      Scheduled: {claim.dateScheduled}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={claim.claimantPublicKey}
                    >
                      To: {claim.claimantPublicKey}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

