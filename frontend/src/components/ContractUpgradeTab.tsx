/**
 * ContractUpgradeTab
 *
 * Admin panel section for managing Soroban contract upgrades.
 * Displays all registered contracts from the backend registry and
 * lets the admin initiate an upgrade flow via UpgradeConfirmModal.
 *
 * Data flow:
 *   1. On mount, fetch the contract list from /api/v1/contracts.
 *   2. Each contract card shows: name, contract ID, current WASM hash,
 *      version, network, and last upgraded timestamp.
 *   3. "Upgrade" button opens UpgradeConfirmModal for the selected contract.
 *   4. On upgrade completion, the contract list is re-fetched to reflect
 *      the new WASM hash without a full page reload.
 *
 * Space complexity: O(n) where n = number of registered contracts.
 * Time complexity: O(n) for initial render; O(1) for subsequent upgrades.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Code2,
  RefreshCw,
  ArrowUpCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import {
  type ContractRecord,
  type UpgradeLog,
  fetchContracts,
  fetchUpgradeLogs,
} from '../services/contractUpgrade';
import UpgradeConfirmModal from './UpgradeConfirmModal';
import { useNotification } from '../hooks/useNotification';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContractUpgradeTabProps {
  /** Connected admin wallet address — passed to the modal as initiatedBy */
  adminAddress: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Compact hash display: first 8 + last 6 chars with monospace styling */
function HashBadge({ hash, full = false }: { hash: string; full?: boolean }) {
  return (
    <code className="font-mono text-xs bg-black/30 px-2 py-0.5 rounded text-accent" title={hash}>
      {full ? hash : `${hash.slice(0, 8)}…${hash.slice(-6)}`}
    </code>
  );
}

/** Network pill badge */
function NetworkBadge({ network }: { network: string }) {
  const isMainnet = network === 'MAINNET';
  return (
    <span
      className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded border ${
        isMainnet
          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      }`}
    >
      {network}
    </span>
  );
}

/** Upgrade log status badge */
function StatusBadge({ status }: { status: UpgradeLog['status'] }) {
  const colorMap: Record<UpgradeLog['status'], string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    simulated: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    confirmed: 'bg-accent/10 text-accent border-accent/30',
    executing: 'bg-accent/10 text-accent border-accent/30',
    completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    failed: 'bg-red-500/10 text-red-500 border-red-500/30',
    cancelled: 'bg-muted/10 text-muted border-muted/30',
  };
  return (
    <span
      className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded border ${colorMap[status]}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ContractCard
// ---------------------------------------------------------------------------

interface ContractCardProps {
  contract: ContractRecord;
  onUpgrade: (contract: ContractRecord) => void;
}

function ContractCard({ contract, onUpgrade }: ContractCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState<UpgradeLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  async function loadHistory() {
    if (logs.length > 0) {
      setShowHistory((v) => !v);
      return;
    }
    setLogsLoading(true);
    try {
      const result = await fetchUpgradeLogs(contract.id, 1, 5);
      setLogs(result.data);
      setShowHistory(true);
    } catch {
      // Silently skip history if unavailable
    } finally {
      setLogsLoading(false);
    }
  }

  return (
    <div className="border border-hi rounded-2xl bg-black/10 backdrop-blur-sm overflow-hidden">
      {/* Card header */}
      <div className="p-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-base">{contract.name}</h3>
            <NetworkBadge network={contract.network} />
            <span className="text-xs text-muted font-mono">v{contract.version}</span>
          </div>
          {contract.description && (
            <p className="text-xs text-muted mt-1 leading-relaxed">{contract.description}</p>
          )}
        </div>

        <button
          onClick={() => onUpgrade(contract)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-accent/15 text-accent border border-accent/30 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent hover:text-black transition-all"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          Upgrade
        </button>
      </div>

      {/* Contract details grid */}
      <div className="px-5 pb-4 grid grid-cols-1 gap-3 border-t border-hi pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted uppercase tracking-widest text-[10px] font-bold mb-1">
              Contract ID
            </p>
            <div className="flex items-center gap-1.5">
              <code className="font-mono text-text/80 truncate">{contract.contract_id}</code>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${contract.contract_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-accent transition-colors shrink-0"
                title="View on Stellar Expert"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div>
            <p className="text-muted uppercase tracking-widest text-[10px] font-bold mb-1">
              Current WASM Hash
            </p>
            <HashBadge hash={contract.current_wasm_hash} />
          </div>
        </div>

        {contract.last_upgraded_at && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>
              Last upgraded:{' '}
              <span className="text-text">
                {new Date(contract.last_upgraded_at).toLocaleString()}
              </span>
              {contract.last_upgraded_by && (
                <>
                  {' by '}
                  <code className="font-mono">{contract.last_upgraded_by.slice(0, 8)}…</code>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Upgrade history toggle */}
      <div className="border-t border-hi">
        <button
          onClick={() => void loadHistory()}
          disabled={logsLoading}
          className="w-full flex items-center justify-between px-5 py-3 text-xs text-muted hover:text-text hover:bg-white/3 transition-colors"
        >
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-widest">
            <Clock className="w-3.5 h-3.5" />
            {logsLoading ? 'Loading history…' : 'Upgrade History'}
          </span>
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHistory && (
          <div className="px-5 pb-4">
            {logs.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">No upgrade history yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-hi text-muted text-[10px] uppercase tracking-widest">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">New Hash</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">TX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-hi/40 hover:bg-white/3 transition-colors"
                      >
                        <td className="py-2 pr-3 font-mono text-muted">
                          {new Date(log.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3">
                          <HashBadge hash={log.new_wasm_hash} />
                        </td>
                        <td className="py-2 pr-3">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="py-2">
                          {log.tx_hash ? (
                            <code className="font-mono text-accent">
                              {log.tx_hash.slice(0, 8)}…
                            </code>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContractUpgradeTab (main export)
// ---------------------------------------------------------------------------

export default function ContractUpgradeTab({ adminAddress }: ContractUpgradeTabProps) {
  const { notifyError } = useNotification();

  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<ContractRecord | null>(null);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchContracts();
      setContracts(data);
    } catch (err: unknown) {
      notifyError(
        'Load Failed',
        err instanceof Error ? err.message : 'Failed to load contract registry.'
      );
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  /** Called when an upgrade completes — refresh the contract list in-place. */
  function handleUpgradeComplete(newWasmHash: string) {
    if (!selectedContract) return;
    // Optimistic update: reflect new hash immediately without a network round-trip
    setContracts((prev) =>
      prev.map((c) =>
        c.id === selectedContract.id
          ? { ...c, current_wasm_hash: newWasmHash, last_upgraded_at: new Date().toISOString() }
          : c
      )
    );
    setSelectedContract(null);
    // Background refresh to sync version and last_upgraded_by from server
    void loadContracts();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Code2 className="w-5 h-5 text-accent" /> Contract Registry
        </h2>
        <button
          onClick={() => void loadContracts()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-black/20 border border-hi rounded hover:bg-black/40 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-muted">
        Manage deployed Soroban smart contract upgrades. Each upgrade triggers a simulation,
        multi-step confirmation, and on-chain execution followed by automated data migration.
      </p>

      {/* No admin address warning */}
      {!adminAddress && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-400">
            Connect your admin wallet to initiate contract upgrades.
          </p>
        </div>
      )}

      {/* Contract list */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="border border-hi rounded-2xl bg-black/10 p-5 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-5 bg-white/5 rounded w-1/3 mb-3" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-hi rounded-2xl bg-black/10">
          <Code2 className="w-10 h-10 text-muted mb-3" />
          <p className="text-muted">No contracts found in registry.</p>
          <p className="text-xs text-muted/60 mt-1">
            Run the database migration to seed the contract registry.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {contracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              onUpgrade={(c) => adminAddress && setSelectedContract(c)}
            />
          ))}
        </div>
      )}

      {/* Multi-step upgrade modal */}
      {selectedContract && adminAddress && (
        <UpgradeConfirmModal
          contract={selectedContract}
          adminAddress={adminAddress}
          onClose={() => setSelectedContract(null)}
          onUpgradeComplete={handleUpgradeComplete}
        />
      )}
    </div>
  );
}
