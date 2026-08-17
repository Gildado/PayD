import React, { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Terminal,
  Filter,
  Search,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { Button } from '@stellar/design-system';
import axiosInstance from '../../api/axiosInstance';
import { toast } from 'sonner';

type JsonRecord = Record<string, unknown>;

interface WebhookLogsResponse {
  data?: WebhookLog[];
}

const LOADING_ROW_KEYS = ['one', 'two', 'three', 'four', 'five'] as const;

interface WebhookLog {
  id: number;
  subscriptionId: number;
  eventType: string;
  payload: JsonRecord | string | null;
  requestHeaders: JsonRecord | null;
  responseStatusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  attemptNumber: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  createdAt: string;
}

const WebhookLogs: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await axiosInstance.get<WebhookLogsResponse>('/api/webhooks/logs');
      setLogs(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch webhook logs:', error);
      toast.error(t('webhooks.logs.fetchError', 'Failed to load delivery logs'));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchLogs();
    const interval = setInterval(() => {
      void fetchLogs();
    }, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={12} />
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle size={12} />
            Failed
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={12} />
            Retrying
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Activity size={12} />
            Pending
          </span>
        );
    }
  };

  const formatJSON = (data: unknown) => {
    try {
      return JSON.stringify(typeof data === 'string' ? JSON.parse(data) : data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="page-fade space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Terminal className="text-emerald-400" />
            {t('webhooks.logs.title', 'Webhook Delivery Logs')}
          </h1>
          <p className="text-slate-400 mt-1">
            {t(
              'webhooks.logs.subtitle',
              'Monitor and debug event deliveries to your configured endpoints.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void fetchLogs();
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Logs Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card !p-0 overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Filter by event or ID..."
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <Button variant="secondary" size="sm" className="ml-2">
                <Filter size={14} className="mr-1.5" />
                Filter
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-500 border-b border-white/5 uppercase text-xs tracking-wider">
                    <th className="px-6 py-4 font-semibold">Event / ID</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                    <th className="px-6 py-4 font-semibold">Time</th>
                    <th className="px-6 py-4 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    LOADING_ROW_KEYS.map((key) => (
                      <tr key={`loading-row-${key}`} className="animate-pulse">
                        <td colSpan={4} className="px-6 py-8 h-16 bg-white/[0.01]" />
                      </tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No delivery logs found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        className={`hover:bg-white/[0.02] cursor-pointer transition-colors ${
                          selectedLog?.id === log.id ? 'bg-emerald-500/5' : ''
                        }`}
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-200">{log.eventType}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            #{log.id.toString().slice(-8)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getStatusBadge(log.status)}
                          {log.responseStatusCode && (
                            <span className="ml-2 text-xs text-slate-500 font-mono">
                              {log.responseStatusCode}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <ChevronRight size={18} className="text-slate-600 inline" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div className="space-y-6">
          {selectedLog ? (
            <div className="card space-y-6 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Activity size={18} className="text-emerald-400" />
                  Delivery Details
                </h2>
                <span className="text-xs text-slate-500 font-mono">ID: {selectedLog.id}</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/2 rounded-lg border border-white/5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                      Attempt
                    </p>
                    <p className="text-lg font-bold font-mono">#{selectedLog.attemptNumber}</p>
                  </div>
                  <div className="p-3 bg-white/2 rounded-lg border border-white/5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                      Status
                    </p>
                    <div className="flex justify-center mt-1">
                      {getStatusBadge(selectedLog.status)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-2">
                    <Code2 size={12} />
                    Payload (Request Data)
                  </label>
                  <pre className="p-3 bg-slate-900 border border-white/10 rounded-lg text-xs text-emerald-400 h-48 overflow-y-auto font-mono scrollbar-thin">
                    {formatJSON(selectedLog.payload)}
                  </pre>
                </div>

                {selectedLog.responseBody && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-2">
                      <ExternalLink size={12} />
                      Response Body
                    </label>
                    <pre className="p-3 bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-300 max-h-32 overflow-y-auto font-mono scrollbar-thin">
                      {formatJSON(selectedLog.responseBody)}
                    </pre>
                  </div>
                )}

                {selectedLog.errorMessage && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
                    <p className="font-semibold uppercase text-[10px] mb-1">Error Message</p>
                    {selectedLog.errorMessage}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5">
                <Button isFullWidth variant="secondary" onClick={() => setSelectedLog(null)}>
                  Close Details
                </Button>
              </div>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-20 text-center space-y-4 text-slate-500">
              <div className="w-16 h-16 rounded-full bg-white/2 flex items-center justify-center border border-white/5 border-dashed">
                <ChevronRight size={24} className="rotate-90 opacity-20" />
              </div>
              <p className="max-w-[180px] text-sm">
                Select a delivery log from the list to view its payload and response details.
              </p>
            </div>
          )}

          {/* Test Utilities */}
          <div className="card bg-emerald-500/5 border-emerald-500/10 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-emerald-300">
              <CheckCircle2 size={18} />
              Developer Tools
            </h3>
            <p className="text-xs text-slate-400">
              Manually trigger a test event to verify your endpoint configuration.
            </p>
            <Button isFullWidth variant="primary" size="sm" className="glow-mint">
              Send Test Ping
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookLogs;
