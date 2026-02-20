import React, { useEffect, useState } from "react";
import { AutosaveIndicator } from "../components/AutosaveIndicator";
import { useAutosave } from "../hooks/useAutosave";
import { createClaimableBalanceTransaction, generateWallet } from "../services/stellar";
import { Button, Card, Input, Select, Alert } from "@stellar/design-system";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

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
          <div>
            <h1
              style={{
                fontWeight: "bold",
                fontSize: "1.5rem",
                marginBottom: "0.25rem",
              }}
            >
              {t("payroll.title", { highlight: t("payroll.titleHighlight") })}
            </h1>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "var(--color-gray-500)",
              }}
            >
              {t("payroll.subtitle")}
            </p>
          </div>
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
              label={t("payroll.employeeName")}
              name="employeeName"
              value={formData.employeeName}
              onChange={handleChange}
              placeholder="John Doe"
            />

            <Input
              id="amount"
              fieldSize="md"
              label={t("payroll.amountLabel")}
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="5000"
            />

            <Select
              id="frequency"
              fieldSize="md"
              label={t("payroll.distributionFrequency")}
              value={formData.frequency}
              onChange={(e) => handleSelectChange("frequency", e.target.value)}
            >
              <option value="weekly">{t("payroll.frequencyWeekly")}</option>
              <option value="monthly">{t("payroll.frequencyMonthly")}</option>
            </Select>

            <Input
              id="startDate"
              fieldSize="md"
              label={t("payroll.commencementDate")}
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              placeholder="2024-01-01"
            />

            <Button id="tour-init-payroll" type="submit" variant="primary" size="md">
              {t("payroll.submit")}
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
