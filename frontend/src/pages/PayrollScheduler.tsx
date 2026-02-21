import React, { useEffect, useState } from "react";
import { AutosaveIndicator } from "../components/AutosaveIndicator";
import { useAutosave } from "../hooks/useAutosave";
import { useTransactionSimulation } from "../hooks/useTransactionSimulation";
import { TransactionSimulationPanel } from "../components/TransactionSimulationPanel";
import { useNotification } from "../providers/NotificationProvider";
import { useSocket } from "../providers/SocketProvider";
import { generateWallet } from "../services/stellar";
import { useTranslation } from "react-i18next";
import { Card } from "@stellar/design-system";
import { SchedulingWizard } from "../components/SchedulingWizard";
import { CountdownTimer } from "../components/CountdownTimer";

interface PayrollFormState {
  employeeName: string;
  amount: string;
  frequency: "weekly" | "monthly";
  startDate: string;
  memo?: string;
}

interface PendingClaim {
  id: string;
  employeeName: string;
  amount: string;
  dateScheduled: string;
  claimantPublicKey: string;
  status: string;
}

const initialFormState: PayrollFormState = {
  employeeName: "",
  amount: "",
  frequency: "monthly",
  startDate: "",
  memo: "",
};

export default function PayrollScheduler() {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { socket, subscribeToTransaction, unsubscribeFromTransaction } = useSocket();
  const [formData, setFormData] = useState<PayrollFormState>(initialFormState);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<any>(null);
  const [nextRunDate, setNextRunDate] = useState<Date | null>(null);

  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>(() => {
    const saved = localStorage.getItem("pending-claims");
    if (saved) {
      try {
        return JSON.parse(saved) as PendingClaim[];
      } catch {
        return [];
      }
    }
    return [];
  });

  const { saving, lastSaved, loadSavedData } = useAutosave<PayrollFormState>(
    "payroll-scheduler-draft",
    formData,
  );

  const {
    simulate,
    resetSimulation,
    isSimulating,
    result: simulationResult,
    error: simulationProcessError,
    isSuccess: simulationPassed,
  } = useTransactionSimulation();

  useEffect(() => {
    const saved = loadSavedData();
    if (saved) {
      setFormData(saved);
    }
  }, [loadSavedData]);

  const handleScheduleComplete = (config: any) => {
    setActiveSchedule(config);
    setIsWizardOpen(false);
    notify("Payroll schedule successfully configured!");

    // Compute next run for countdown demo
    const d = new Date();
    if (config.frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (config.frequency === 'weekly') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 14);

    setNextRunDate(d);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (simulationResult) resetSimulation();
  };

  useEffect(() => {
    if (!socket) return;

    const handleTransactionUpdate = (data: any) => {
      console.log("Received transaction update:", data);
      setPendingClaims((prev) =>
        prev.map((claim) =>
          claim.id === data.transactionId
            ? { ...claim, status: data.status }
            : claim
        )
      );
      
      if (data.status === 'confirmed') {
        notify(`Payment ${data.transactionId} confirmed!`);
      }
    };

    socket.on('transaction:update', handleTransactionUpdate);

    return () => {
      socket.off('transaction:update', handleTransactionUpdate);
    };
  }, [socket, notify]);

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeName || !formData.amount) {
      notify("Please fill in all required fields.");
      return;
    }

    // Mock XDR for simulation demonstration
    // In a real app, this would be built using the Stellar SDK from formData
    const mockXdr =
      "AAAAAgAAAABmF8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    await simulate({ envelopeXdr: mockXdr });
  };

  const handleBroadcast = async () => {
    setIsBroadcasting(true);
    try {
      // Simulate a brief delay for network broadcast
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Add to pending claims
      const newClaim: PendingClaim = {
        id: Math.random().toString(36).substr(2, 9),
        employeeName: formData.employeeName,
        amount: formData.amount,
        dateScheduled:
          formData.startDate || new Date().toISOString().split("T")[0],
        claimantPublicKey: generateWallet().publicKey,
        status: "Pending Claim",
      };
      const updatedClaims = [...pendingClaims, newClaim];
      setPendingClaims(updatedClaims);
      localStorage.setItem("pending-claims", JSON.stringify(updatedClaims));

      // Subscribe to updates for this new claim
      subscribeToTransaction(newClaim.id);

      notify("Payroll stream successfully broadcasted to Stellar network!");
      resetSimulation();
      setFormData(initialFormState);
    } catch (err) {
      console.error(err);
      notify("Broadcast failed. Please check your connection.");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleRemoveClaim = (id: string) => {
    unsubscribeFromTransaction(id);
    const updatedClaims = pendingClaims.filter((c) => c.id !== id);
    setPendingClaims(updatedClaims);
    localStorage.setItem("pending-claims", JSON.stringify(updatedClaims));
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-6xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            {t("payroll.title", "Payroll")}{" "}
            <span className="text-accent">
              {t("payroll.titleHighlight", "Scheduler")}
            </span>
          </h1>
          <p className="text-muted font-mono text-sm tracking-wider uppercase">
            {t("payroll.subtitle", "Automated distribution engine")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AutosaveIndicator saving={saving} lastSaved={lastSaved} />
          <button
            onClick={() => setIsWizardOpen(true)}
            className="bg-accent/10 border border-accent/30 text-accent font-bold px-4 py-2 rounded-lg text-sm hover:bg-accent/20 transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            Configure Automation
          </button>
        </div>
      </div>

      {activeSchedule && (
        <div className="w-full mb-12 bg-black/20 border border-success/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-success"></div>
          <div>
            <h3 className="text-success font-black text-lg mb-1 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Automation Active
            </h3>
            <p className="text-muted text-sm">Scheduled to run <span className="font-bold text-text capitalize">{activeSchedule.frequency}</span> at <span className="font-mono text-text">{activeSchedule.timeOfDay}</span></p>
          </div>
          <div className="bg-bg border border-hi rounded-xl p-4 shadow-inner">
            <span className="block text-[10px] uppercase font-bold text-muted mb-2 tracking-widest text-center">Next Scheduled Run</span>
            <CountdownTimer targetDate={nextRunDate} />
          </div>
        </div>
      )}

      {isWizardOpen ? (
        <SchedulingWizard
          onComplete={handleScheduleComplete}
          onCancel={() => setIsWizardOpen(false)}
        />
      ) : (
        <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
          {/* Form Section */}
          <div className="lg:col-span-3">
            <form
              onSubmit={(e: React.FormEvent) => {
                void handleInitialize(e);
              }}
              className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 card glass noise"
            >
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                  {t("payroll.employeeName", "Employee Name")}
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
                  {t("payroll.amountLabel", "Amount (USD equivalent)")}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-mono">
                    $
                  </span>
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
                  {t("payroll.distributionFrequency", "Distribution Frequency")}
                </label>
                <select
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                  className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all appearance-none cursor-pointer"
                >
                  <option value="weekly" className="bg-surface">
                    {t("payroll.frequencyWeekly", "Weekly")}
                  </option>
                  <option value="monthly" className="bg-surface">
                    {t("payroll.frequencyMonthly", "Monthly")}
                  </option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                  {t("payroll.commencementDate", "Commencement Date")}
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
                    {isSimulating
                      ? "Simulating..."
                      : t("payroll.submit", "Initialize and Validate")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void handleBroadcast();
                    }}
                    disabled={isBroadcasting}
                    className="w-full py-4 bg-success text-bg font-black rounded-xl hover:scale-[1.01] transition-transform shadow-lg shadow-success/10 uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                  >
                    {isBroadcasting
                      ? "Broadcasting..."
                      : "Confirm & Broadcast to Network"}
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Pre-flight Validation
              </h3>
              <p className="text-xs text-muted leading-relaxed mb-4">
                All transactions are simulated via Stellar Horizon before
                submission. This catches common errors like:
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
      )}

      {/* Pending Claims Section */}
      <div className="w-full">
        <h2 className="text-xl font-bold mb-4">Pending Claims</h2>
        <Card>
          {pendingClaims.length === 0 ? (
            <p className="text-muted">No pending claimable balances.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {pendingClaims.map((claim: PendingClaim) => (
                <li key={claim.id} className="border border-hi p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <h3 className="font-bold">{claim.employeeName}</h3>
                    <span className="bg-accent/20 text-accent px-2 py-1 rounded-full text-xs">
                      {claim.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted flex justify-between items-center">
                    <p>Amount: {claim.amount} USDC</p>
                    <button
                      onClick={() => handleRemoveClaim(claim.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Cancel
                    </button>
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
