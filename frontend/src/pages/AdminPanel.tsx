import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Activity,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Code2,
  Shield,
} from 'lucide-react';
import { useNotification } from '../hooks/useNotification';
import { useWallet } from '../hooks/useWallet';
import ContractUpgradeTab from '../components/ContractUpgradeTab';
import MultisigDetector from '../components/MultisigDetector';
import { FormField } from '../components/FormField';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { Button, Input, Heading, Text, Card } from '@stellar/design-system';

const InputComponent = Input as unknown as React.FC<Record<string, unknown>>;

/** Centralized API base so URL changes happen in one place. */
const API_BASE = '/api/v1';

const LOGS_PER_PAGE = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FreezeLog {
  id: number;
  target_account: string;
  asset_code: string;
  asset_issuer: string;
  action: 'freeze' | 'unfreeze';
  scope: 'account' | 'global';
  initiated_by: string;
  reason: string | null;
  created_at: string;
}

interface StatusResult {
  targetAccount: string;
  assetCode: string;
  assetIssuer: string;
  isFrozen: boolean;
  latestAction: FreezeLog | null;
}

interface ActionApiResponse {
  success: boolean;
  message: string;
  error?: string;
}

interface LogsApiResponse {
  success: boolean;
  data: FreezeLog[];
  total: number;
}

type ActiveTab = 'account' | 'global' | 'status' | 'logs' | 'contracts' | 'multisig';

const TAB_LABELS: Record<ActiveTab, string> = {
  account: 'Account Control',
  global: 'Global Asset Control',
  status: 'Status Check',
  logs: 'Audit Logs',
  contracts: 'Contract Upgrades',
  multisig: 'Multisig Detection',
};

export default function AdminPanel() {
  const { notifySuccess, notifyError, notifyApiError } = useNotification();
  const { address: adminAddress } = useWallet();

  const [activeTab, setActiveTab] = useState<ActiveTab>('account');

  // Account Control
  const [accountTarget, setAccountTarget] = useState('');
  const [accountAsset, setAccountAsset] = useState('ORGUSD');
  const [accountSecret, setAccountSecret] = useState('');
  const [accountReason, setAccountReason] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  // Global Control
  const [globalAsset, setGlobalAsset] = useState('ORGUSD');
  const [globalSecret, setGlobalSecret] = useState('');
  const [globalReason, setGlobalReason] = useState('');
  const [globalLoading, setGlobalLoading] = useState(false);

  // Status Check
  const [statusTarget, setStatusTarget] = useState('');
  const [statusAsset, setStatusAsset] = useState('ORGUSD');
  const [statusIssuer, setStatusIssuer] = useState('');
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Audit Logs
  const [logs, setLogs] = useState<FreezeLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);

  // -----------------------------------------------------------------------
  // Data fetchers
  // -----------------------------------------------------------------------

  const loadLogs = useCallback(
    async (page: number) => {
      setLogsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/freeze/logs?page=${page}&limit=${LOGS_PER_PAGE}`);
        const data = (await res.json()) as LogsApiResponse;
        if (data.success) {
          setLogs(data.data);
          setLogsTotal(data.total);
        }
      } catch {
        notifyApiError('Fetch Error', 'Failed to load audit logs.');
      } finally {
        setLogsLoading(false);
      }
    },
    [notifyApiError]
  );

  useEffect(() => {
    if (activeTab === 'logs') {
      void loadLogs(logsPage);
    }
  }, [activeTab, logsPage, loadLogs]);

  // -----------------------------------------------------------------------
  // Action handlers
  // -----------------------------------------------------------------------

  async function handleAccountAction(action: 'freeze' | 'unfreeze') {
    if (!accountTarget || !accountAsset || !accountSecret) {
      notifyError('Missing fields', 'Target account, asset code, and issuer secret are required.');
      return;
    }
    setAccountLoading(true);
    try {
      const res = await fetch(`${API_BASE}/freeze/account/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerSecret: accountSecret,
          targetAccount: accountTarget,
          assetCode: accountAsset,
          reason: accountReason || undefined,
        }),
      });
      const data = (await res.json()) as ActionApiResponse;
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      notifySuccess('Success', data.message);
      setAccountSecret('');
      setAccountReason('');
    } catch (err: unknown) {
      notifyApiError('Action Failed', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setAccountLoading(false);
    }
  }

  async function handleGlobalAction(action: 'freeze' | 'unfreeze') {
    if (!globalAsset || !globalSecret) {
      notifyError('Missing fields', 'Asset code and issuer secret are required.');
      return;
    }
    setGlobalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/freeze/global/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerSecret: globalSecret,
          assetCode: globalAsset,
          reason: globalReason || undefined,
        }),
      });
      const data = (await res.json()) as ActionApiResponse;
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      notifySuccess('Success', data.message);
      setGlobalSecret('');
      setGlobalReason('');
    } catch (err: unknown) {
      notifyApiError('Action Failed', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setGlobalLoading(false);
    }
  }

  async function handleStatusCheck() {
    if (!statusTarget || !statusAsset || !statusIssuer) {
      notifyError('Missing fields', 'Target account, asset code, and asset issuer are required.');
      return;
    }
    setStatusLoading(true);
    setStatusResult(null);
    try {
      const params = new URLSearchParams({
        assetCode: statusAsset,
        assetIssuer: statusIssuer,
      });
      const res = await fetch(
        `${API_BASE}/freeze/status/${encodeURIComponent(statusTarget)}?${params}`
      );
      const data = (await res.json()) as StatusResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Status check failed');
      setStatusResult(data);
    } catch (err: unknown) {
      notifyApiError(
        'Status Check Failed',
        err instanceof Error ? err.message : 'Status check failed'
      );
    } finally {
      setStatusLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(logsTotal / LOGS_PER_PAGE));

  function tabClass(tab: ActiveTab) {
    return activeTab === tab
      ? 'pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-colors text-text border-b-2 border-accent'
      : 'pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-colors text-muted border-transparent hover:text-text';
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="w-full mb-8 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <Heading as="h1" size="lg" weight="bold" addlClassName="mb-2 tracking-tight">
            Security <span className="text-red-500">Center</span>
          </Heading>
          <Text
            as="p"
            size="sm"
            weight="regular"
            addlClassName="text-muted font-mono tracking-wider uppercase"
          >
            Asset Freeze & Administrative Controls
          </Text>
        </div>
      </div>

      {/* Tab bar */}
      <div className="w-full mb-8 flex gap-4 border-b border-hi overflow-x-auto">
        {(Object.keys(TAB_LABELS) as ActiveTab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={tabClass(tab)}>
            {tab === 'contracts' && <Code2 className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />}
            {tab === 'multisig' && <Shield className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />}
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <Card>
        {/* ── Account Control ─────────────────────────────────────── */}
        {activeTab === 'account' && (
          <div className="flex flex-col gap-6 max-w-2xl">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Account Level Freeze
            </h2>
            <p className="text-sm text-muted">
              Instantly block or restore an individual account's ability to transact with your
              asset.
            </p>

            <div className="grid gap-6">
              <FormField id="accountTarget" label="Target Account (Public Key)" required>
                <InputComponent
                  fieldSize="md"
                  id="accountTarget"
                  name="accountTarget"
                  value={accountTarget}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAccountTarget(e.target.value.trim())
                  }
                  placeholder="G..."
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField id="accountAsset" label="Asset Code" required>
                  <InputComponent
                    fieldSize="md"
                    id="accountAsset"
                    name="accountAsset"
                    value={accountAsset}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setAccountAsset(e.target.value.toUpperCase().trim())
                    }
                  />
                </FormField>
                <FormField id="accountSecret" label="Issuer Secret Key" required>
                  <InputComponent
                    fieldSize="md"
                    id="accountSecret"
                    name="accountSecret"
                    type="password"
                    value={accountSecret}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setAccountSecret(e.target.value.trim())
                    }
                    placeholder="S..."
                  />
                </FormField>
              </div>

              <FormField id="accountReason" label="Reason (Audit Log)">
                <InputComponent
                  fieldSize="md"
                  id="accountReason"
                  name="accountReason"
                  value={accountReason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAccountReason(e.target.value)
                  }
                  placeholder="e.g. Suspicious activity detected"
                />
              </FormField>
            </div>

            <div className="flex gap-4 mt-4">
              <Button
                variant="destructive"
                size="md"
                disabled={accountLoading}
                onClick={() => void handleAccountAction('freeze')}
                isFullWidth
              >
                {accountLoading ? 'Processing...' : 'Freeze Account'}
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={accountLoading}
                onClick={() => void handleAccountAction('unfreeze')}
                isFullWidth
              >
                {accountLoading ? 'Processing...' : 'Unfreeze Account'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Global Asset Control ─────────────────────────────────── */}
        {activeTab === 'global' && (
          <div className="flex flex-col gap-6 max-w-2xl">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" /> Global Asset Freeze
            </h2>
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-400 text-sm">
              <strong>WARNING:</strong> This will freeze ALL accounts holding this asset. Reserve
              for systemic security breaches only.
            </div>

            <div className="grid gap-6 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField id="globalAsset" label="Asset Code" required>
                  <InputComponent
                    fieldSize="md"
                    id="globalAsset"
                    name="globalAsset"
                    value={globalAsset}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setGlobalAsset(e.target.value.toUpperCase().trim())
                    }
                  />
                </FormField>
                <FormField id="globalSecret" label="Issuer Secret Key" required>
                  <InputComponent
                    fieldSize="md"
                    id="globalSecret"
                    name="globalSecret"
                    type="password"
                    value={globalSecret}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setGlobalSecret(e.target.value.trim())
                    }
                    placeholder="S..."
                  />
                </FormField>
              </div>

              <FormField id="globalReason" label="Reason (Audit Log)">
                <InputComponent
                  fieldSize="md"
                  id="globalReason"
                  name="globalReason"
                  value={globalReason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setGlobalReason(e.target.value)
                  }
                  placeholder="Mandatory systemic freeze reason"
                />
              </FormField>
            </div>

            <div className="flex gap-4 mt-4">
              <Button
                variant="destructive"
                size="md"
                disabled={globalLoading}
                onClick={() => void handleGlobalAction('freeze')}
                isFullWidth
              >
                {globalLoading ? 'Processing...' : 'Engage Global Freeze'}
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={globalLoading}
                onClick={() => void handleGlobalAction('unfreeze')}
                isFullWidth
              >
                {globalLoading ? 'Processing...' : 'Lift Global Freeze'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Status Check ─────────────────────────────────────────── */}
        {activeTab === 'status' && (
          <div className="flex flex-col gap-6 max-w-2xl">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-accent" /> Trustline Status
            </h2>
            <p className="text-sm text-muted">
              Verify whether an account's trustline is currently frozen for a given asset.
            </p>

            <div className="grid gap-6">
              <FormField id="statusTarget" label="Target Account (Public Key)" required>
                <InputComponent
                  fieldSize="md"
                  id="statusTarget"
                  name="statusTarget"
                  value={statusTarget}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setStatusTarget(e.target.value.trim())
                  }
                  placeholder="G..."
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField id="statusAsset" label="Asset Code" required>
                  <InputComponent
                    fieldSize="md"
                    id="statusAsset"
                    name="statusAsset"
                    value={statusAsset}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setStatusAsset(e.target.value.toUpperCase().trim())
                    }
                  />
                </FormField>
                <FormField id="statusIssuer" label="Asset Issuer (Public Key)" required>
                  <InputComponent
                    fieldSize="md"
                    id="statusIssuer"
                    name="statusIssuer"
                    value={statusIssuer}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setStatusIssuer(e.target.value.trim())
                    }
                    placeholder="G..."
                  />
                </FormField>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={statusLoading}
              onClick={() => void handleStatusCheck()}
            >
              {statusLoading ? 'Checking...' : 'Check Status'}
            </Button>

            {statusResult && (
              <div className="p-6 border border-hi rounded-xl bg-black/20 mt-4">
                <div className="flex items-center gap-4 mb-5">
                  <span className="text-sm font-bold uppercase tracking-widest text-muted">
                    Status
                  </span>
                  <span
                    className={`px-3 py-1 rounded text-xs font-black uppercase tracking-widest border ${
                      statusResult.isFrozen
                        ? 'bg-red-500/20 text-red-500 border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                    }`}
                  >
                    {statusResult.isFrozen ? 'Frozen' : 'Active'}
                  </span>
                </div>
                <dl className="grid gap-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-muted min-w-[110px]">Account</dt>
                    <dd className="font-mono text-xs truncate">{statusResult.targetAccount}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted min-w-[110px]">Asset</dt>
                    <dd className="font-bold">{statusResult.assetCode}</dd>
                  </div>
                  {statusResult.latestAction && (
                    <>
                      <div className="flex gap-2">
                        <dt className="text-muted min-w-[110px]">Last Action</dt>
                        <dd className="capitalize">{statusResult.latestAction.action}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted min-w-[110px]">Reason</dt>
                        <dd>{statusResult.latestAction.reason || '—'}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted min-w-[110px]">Timestamp</dt>
                        <dd className="font-mono text-xs">
                          {new Date(statusResult.latestAction.created_at).toLocaleString()}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}

        {/* ── Contract Upgrades ────────────────────────────────────── */}
        {activeTab === 'contracts' && <ContractUpgradeTab adminAddress={adminAddress ?? ''} />}

        {/* ── Multisig Detection ───────────────────────────────────── */}
        {activeTab === 'multisig' && <MultisigDetector />}

        {/* ── Audit Logs ───────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent" /> Freeze Audit Logs
              </h2>
              <div className="flex items-center gap-3">
                {logsTotal > 0 && (
                  <span className="text-xs text-muted">
                    {(logsPage - 1) * LOGS_PER_PAGE + 1}–
                    {Math.min(logsPage * LOGS_PER_PAGE, logsTotal)} of {logsTotal}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadLogs(logsPage)}
                  disabled={logsLoading}
                >
                  {logsLoading ? 'Loading…' : 'Refresh'}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hi text-muted uppercase tracking-wider text-[10px]">
                    <th className="p-3">Time</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Asset</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Scope</th>
                    <th className="p-3">Reason</th>
                  </tr>
                </thead>
                <tbody aria-busy={logsLoading}>
                  {logsLoading && logs.length === 0 ? (
                    <SkeletonLoader variant="table-row" count={5} columns={6} />
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted">
                        No freeze logs found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log: FreezeLog) => (
                      <tr
                        key={log.id}
                        className="border-b border-hi/50 hover:bg-white/5 transition-colors"
                      >
                        <td className="p-3 text-xs font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 text-xs font-mono" title={log.target_account}>
                          {log.target_account.slice(0, 8)}…{log.target_account.slice(-4)}
                        </td>
                        <td className="p-3 text-xs font-bold">{log.asset_code}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest ${
                              log.action === 'freeze'
                                ? 'bg-red-500/20 text-red-500'
                                : 'bg-emerald-500/20 text-emerald-500'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-xs capitalize text-muted">{log.scope}</td>
                        <td
                          className="p-3 text-xs text-muted max-w-[200px] truncate"
                          title={log.reason || ''}
                        >
                          {log.reason || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setLogsPage((p: number) => Math.max(1, p - 1))}
                  disabled={logsPage === 1 || logsLoading}
                >
                  <ChevronLeft className="w-3 h-3 mr-1" /> Previous
                </Button>
                <span className="text-xs text-muted">
                  Page {logsPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setLogsPage((p: number) => Math.min(totalPages, p + 1))}
                  disabled={logsPage === totalPages || logsLoading}
                >
                  Next <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
