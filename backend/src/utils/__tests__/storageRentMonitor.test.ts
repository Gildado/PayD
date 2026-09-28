import {
  checkLedgerEntryTtl,
  checkMultipleLedgerEntryTtls,
  formatRentReport,
} from '../storageRentMonitor.js';

const LEDGERS_PER_DAY = Math.round((24 * 60 * 60) / 5);

function mockServer(overrides: {
  liveUntilLedgerSeq?: number | null;
  currentLedger?: number;
  noEntry?: boolean;
}) {
  return {
    getLedgerEntries: jest.fn().mockResolvedValue({
      entries: overrides.noEntry
        ? []
        : [{ liveUntilLedgerSeq: overrides.liveUntilLedgerSeq }],
    }),
    getLatestLedger: jest
      .fn()
      .mockResolvedValue({ sequence: overrides.currentLedger ?? 1_000_000 }),
  } as any;
}

describe('checkLedgerEntryTtl (#1618)', () => {
  it('classifies as healthy when comfortably above the watch threshold', async () => {
    const server = mockServer({
      currentLedger: 1_000_000,
      liveUntilLedgerSeq: 1_000_000 + LEDGERS_PER_DAY * 30,
    });

    const result = await checkLedgerEntryTtl(server, 'bulk_payment:Admin', 'AAAA==');

    expect(result.status).toBe('healthy');
    expect(result.daysRemaining).toBeCloseTo(30, 0);
  });

  it('classifies as watch when inside the watch window but outside critical', async () => {
    const server = mockServer({
      currentLedger: 1_000_000,
      liveUntilLedgerSeq: 1_000_000 + LEDGERS_PER_DAY * 7,
    });

    const result = await checkLedgerEntryTtl(server, 'bulk_payment:Admin', 'AAAA==', {
      watchDays: 14,
      criticalDays: 3,
    });

    expect(result.status).toBe('watch');
  });

  it('classifies as critical when inside the critical window', async () => {
    const server = mockServer({
      currentLedger: 1_000_000,
      liveUntilLedgerSeq: 1_000_000 + LEDGERS_PER_DAY * 1,
    });

    const result = await checkLedgerEntryTtl(server, 'bulk_payment:Admin', 'AAAA==', {
      criticalDays: 3,
    });

    expect(result.status).toBe('critical');
  });

  it('classifies as expired when liveUntilLedgerSeq is already behind the current ledger', async () => {
    const server = mockServer({
      currentLedger: 1_000_000,
      liveUntilLedgerSeq: 999_000,
    });

    const result = await checkLedgerEntryTtl(server, 'bulk_payment:Admin', 'AAAA==');

    expect(result.status).toBe('expired');
    expect(result.daysRemaining).toBeLessThan(0);
  });

  it('classifies as not_found when the entry has already been archived off ledger state', async () => {
    const server = mockServer({ noEntry: true });

    const result = await checkLedgerEntryTtl(server, 'bulk_payment:Admin', 'AAAA==');

    expect(result.status).toBe('not_found');
    expect(result.daysRemaining).toBeNull();
  });
});

describe('checkMultipleLedgerEntryTtls', () => {
  it('checks every target against the same server', async () => {
    const server = mockServer({
      currentLedger: 1_000_000,
      liveUntilLedgerSeq: 1_000_000 + LEDGERS_PER_DAY * 30,
    });

    const results = await checkMultipleLedgerEntryTtls(server, [
      { contractLabel: 'bulk_payment:Admin', ledgerKeyXdr: 'AAAA==' },
      { contractLabel: 'revenue_split:Recipients', ledgerKeyXdr: 'BBBB==' },
    ]);

    expect(results).toHaveLength(2);
    expect(server.getLedgerEntries).toHaveBeenCalledTimes(2);
  });
});

describe('formatRentReport', () => {
  it('renders one line per result with status and days remaining', () => {
    const report = formatRentReport([
      {
        contractLabel: 'bulk_payment:Admin',
        ledgerKeyXdr: 'AAAA==',
        currentLedger: 1_000_000,
        liveUntilLedgerSeq: 1_050_000,
        ledgersRemaining: 50_000,
        daysRemaining: 2.9,
        status: 'critical',
      },
    ]);

    expect(report).toContain('bulk_payment:Admin');
    expect(report).toContain('critical');
    expect(report).toContain('2.9');
  });
});
