import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Activity,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Code2,
} from 'lucide-react';
import { useNotification } from '../hooks/useNotification';
import { useWallet } from '../hooks/useWallet';
import ContractUpgradeTab from '../components/ContractUpgradeTab';

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

type ActiveTab = 'account' | 'global' | 'status' | 'logs' | 'contracts';

// ---------------------------------------------------------------------------
// Style constants – defined once to avoid repetition
// ---------------------------------------------------------------------------

const INPUT_CLASS =
  'w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none ' +
  'focus:border-accent/50 focus:bg-accent/5 transition-all font-mono text-sm';

const LABEL_CLASS = 'block text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1';

const TAB_LABELS: Record<ActiveTab, string> = {
  account: 'Account Control',
  global: 'Global Asset Control',
  status: 'Status Check',
  logs: 'Audit Logs',
  contracts: 'Contract Upgrades',
};

export default function AdminPanel() {
  const { notifySuccess, notifyError } = useNotification();
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

  useEffect(() => {
    if (activeTab === 'logs') {
      void loadLogs(logsPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, logsPage]);

  // -----------------------------------------------------------------------
  // Data fetchers
  // -----------------------------------------------------------------------

  async function loadLogs(page: number) {
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/freeze/logs?page=${page}&limit=${LOGS_PER_PAGE}`);
      const data = (await res.json()) as LogsApiResponse;
      if (data.success) {
        setLogs(data.data);
        setLogsTotal(data.total);
      }
    } catch {
      notifyError('Fetch Error', 'Failed to load audit logs.');
    } finally {
      setLogsLoading(false);
    }
  }

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
      notifyError('Action Failed', err instanceof Error ? err.message : 'Action failed');
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
      notifyError('Action Failed', err instanceof Error ? err.message : 'Action failed');
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
      notifyError(
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

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="w-full mb-8 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            Security <span className="text-red-500">Center</span>
          </h1>
          <p className="text-muted font-mono text-sm tracking-wider uppercase">
            Asset Freeze & Administrative Controls
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="w-full mb-8 flex gap-4 border-b border-hi overflow-x-auto">
        {(Object.keys(TAB_LABELS) as ActiveTab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={tabClass(tab)}>
            {tab === 'contracts' && <Code2 className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />}
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="w-full border border-hi rounded-2xl p-8 bg-black/10 backdrop-blur-md">
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

            <div className="grid gap-4">
              <div>
                <label className={LABEL_CLASS}>Target Account (Public Key)</label>
                <input
                  type="text"
                  value={accountTarget}
                  onChange={(e) => setAccountTarget(e.target.value.trim())}
                  className={INPUT_CLASS}
                  placeholder="G..."
                  spellCheck={false}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>Asset Code</label>
                  <input
                    type="text"
                    value={accountAsset}
                    onChange={(e) => setAccountAsset(e.target.value.toUpperCase().trim())}
                    className={INPUT_CLASS}
                    maxLength={12}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Issuer Secret Key</label>
                  <input
                    type="password"
                    value={accountSecret}
                    onChange={(e) => setAccountSecret(e.target.value.trim())}
                    className={INPUT_CLASS}
                    placeholder="S..."
                    autoComplete="off"
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_CLASS}>Reason (Audit Log)</label>
                <input
                  type="text"
                  value={accountReason}
                  onChange={(e) => setAccountReason(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="e.g. Suspicious activity detected"
                  maxLength={500}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <button
                disabled={accountLoading}
                onClick={() => void handleAccountAction('freeze')}
                className="flex-1 py-4 bg-red-500/20 text-red-500 border border-red-500/50 font-black rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accountLoading ? 'Processing...' : 'Freeze Account'}
              </button>
              <button
                disabled={accountLoading}
                onClick={() => void handleAccountAction('unfreeze')}
                className="flex-1 py-4 bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 font-black rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accountLoading ? 'Processing...' : 'Unfreeze Account'}
              </button>
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

            <div className="grid gap-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>Asset Code</label>
                  <input
                    type="text"
                    value={globalAsset}
                    onChange={(e) => setGlobalAsset(e.target.value.toUpperCase().trim())}
                    className={INPUT_CLASS}
                    maxLength={12}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Issuer Secret Key</label>
                  <input
                    type="password"
                    value={globalSecret}
                    onChange={(e) => setGlobalSecret(e.target.value.trim())}
                    className={INPUT_CLASS}
                    placeholder="S..."
                    autoComplete="off"
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_CLASS}>Reason (Audit Log)</label>
                <input
                  type="text"
                  value={globalReason}
                  onChange={(e) => setGlobalReason(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Mandatory systemic freeze reason"
                  maxLength={500}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <button
                disabled={globalLoading}
                onClick={() => void handleGlobalAction('freeze')}
                className="flex-1 py-4 bg-red-600/30 text-red-400 border border-red-500/50 font-black rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-lg uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {globalLoading ? 'Processing...' : 'Engage Global Freeze'}
              </button>
              <button
                disabled={globalLoading}
                onClick={() => void handleGlobalAction('unfreeze')}
                className="flex-1 py-4 bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 font-black rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {globalLoading ? 'Processing...' : 'Lift Global Freeze'}
              </button>
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

            <div className="grid gap-4">
              <div>
                <label className={LABEL_CLASS}>Target Account (Public Key)</label>
                <input
                  type="text"
                  value={statusTarget}
                  onChange={(e) => setStatusTarget(e.target.value.trim())}
                  className={INPUT_CLASS}
                  placeholder="G..."
                  spellCheck={false}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>Asset Code</label>
                  <input
                    type="text"
                    value={statusAsset}
                    onChange={(e) => setStatusAsset(e.target.value.toUpperCase().trim())}
                    className={INPUT_CLASS}
                    maxLength={12}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Asset Issuer (Public Key)</label>
                  <input
                    type="text"
                    value={statusIssuer}
                    onChange={(e) => setStatusIssuer(e.target.value.trim())}
                    className={INPUT_CLASS}
                    placeholder="G..."
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>

            <button
              disabled={statusLoading}
              onClick={() => void handleStatusCheck()}
              className="py-4 bg-black/20 border border-hi font-black rounded-xl hover:bg-black/40 transition-all shadow-lg uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {statusLoading ? 'Checking...' : 'Check Status'}
            </button>

            {statusResult && (
              <div className="p-6 border border-hi rounded-xl bg-black/20">
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
                <button
                  onClick={() => void loadLogs(logsPage)}
                  disabled={logsLoading}
                  className="text-xs bg-black/20 px-3 py-1.5 rounded border border-hi hover:bg-black/40 disabled:opacity-50"
                >
                  {logsLoading ? 'Loading…' : 'Refresh'}
                </button>
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
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted">
                        {logsLoading ? 'Loading…' : 'No freeze logs found.'}
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
                <button
                  onClick={() => setLogsPage((p: number) => Math.max(1, p - 1))}
                  disabled={logsPage === 1 || logsLoading}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-hi rounded hover:bg-black/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3 h-3" /> Previous
                </button>
                <span className="text-xs text-muted">
                  Page {logsPage} of {totalPages}
                </span>
                <button
                  onClick={() => setLogsPage((p: number) => Math.min(totalPages, p + 1))}
                  disabled={logsPage === totalPages || logsLoading}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-hi rounded hover:bg-black/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
