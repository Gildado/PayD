import { contractService } from './contracts';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';

export interface HistoryFilters {
  search: string;
  status: string;
  employee: string;
  asset: string;
  startDate: string;
  endDate: string;
}

export interface TimelineItem {
  id: string;
  kind: 'classic' | 'contract';
  createdAt: string;
  status: string;
  amount: string;
  asset: string;
  actor: string;
  txHash: string | null;
  label: string;
  badge: string;
}

interface AuditResponse {
  data: Array<Record<string, unknown>>;
  total: number;
  page: number;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    query.set(key, String(value));
  });
  return query.toString();
}

function normalizeClassicItem(row: Record<string, unknown>): TimelineItem {
  const txHash = asString(row.tx_hash, '') || null;
  return {
    id: `audit-${asString(row.id, txHash ?? 'unknown')}`,
    kind: 'classic',
    createdAt: asString(row.created_at, asString(row.stellar_created_at, new Date().toISOString())),
    status: (row.successful as boolean) === false ? 'failed' : 'confirmed',
    amount: asString(row.fee_charged, '0'),
    asset: 'XLM',
    actor: asString(row.source_account, 'Unknown'),
    txHash,
    label: 'Classic Stellar Transaction',
    badge: 'Classic',
  };
}

function normalizeContractItem(contractId: string, row: Record<string, unknown>): TimelineItem {
  return {
    id: `contract-${asString(row.event_id, asString(row.id, 'unknown'))}`,
    kind: 'contract',
    createdAt: asString(row.created_at, new Date().toISOString()),
    status: 'indexed',
    amount: asString((row.payload as Record<string, unknown> | undefined)?.amount, '0'),
    asset: asString((row.payload as Record<string, unknown> | undefined)?.asset_code, 'N/A'),
    actor: contractId,
    txHash: asString(row.tx_hash, '') || null,
    label: asString(row.event_type, 'contract_event'),
    badge: 'Contract Event',
  };
}

export async function fetchHistoryPage(options: {
  page: number;
  limit: number;
  filters: HistoryFilters;
}): Promise<{ items: TimelineItem[]; hasMore: boolean }> {
  const { page, limit, filters } = options;
  const query = toQuery({
    page,
    limit,
    status: filters.status || undefined,
    employee: filters.employee || undefined,
    asset: filters.asset || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    search: filters.search || undefined,
  });

  const auditResponse = await fetch(`${API_BASE_URL}/api/v1/audit?${query}`);
  if (!auditResponse.ok) {
    throw new Error(`Failed to fetch audit records (${auditResponse.status})`);
  }

  const auditPayload = (await auditResponse.json()) as AuditResponse;
  const classicItems = (auditPayload.data || []).map(normalizeClassicItem);

  await contractService.initialize();
  const contractIds = [
    contractService.getContractId('bulk_payment', 'testnet'),
    contractService.getContractId('vesting_escrow', 'testnet'),
    contractService.getContractId('revenue_split', 'testnet'),
  ].filter((value): value is string => Boolean(value));

  const contractItems: TimelineItem[] = [];
  await Promise.all(
    contractIds.map(async (contractId) => {
      try {
        const eventResponse = await fetch(
          `${API_BASE_URL}/api/events/${contractId}?page=1&limit=10`
        );
        if (!eventResponse.ok) return;
        const payload = (await eventResponse.json()) as {
          data?: Array<Record<string, unknown>>;
        };
        (payload.data || []).forEach((row) => {
          contractItems.push(normalizeContractItem(contractId, row));
        });
      } catch {
        // Contract event index may not be available yet; continue with classic timeline.
      }
    })
  );

  const merged = [...classicItems, ...contractItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const hasMore = page * limit < (auditPayload.total || 0);
  return { items: merged, hasMore };
}
