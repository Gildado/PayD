import { useState, useEffect, useCallback } from 'react';
import { fetchExchangeRates, getStellarExpertLink } from '../services/currencyConversion';

/**
 * Mock transaction data representing incoming payments for an employee.
 * In production, this would come from the backend API or Stellar Horizon.
 */
export interface EmployeeTransaction {
  id: string;
  txHash: string;
  date: string;
  amount: number;
  assetCode: string;
  from: string;
  memo: string;
  status: 'completed' | 'pending' | 'failed';
  type: 'salary' | 'bonus' | 'reimbursement';
  stellarExpertUrl: string;
}

export interface EmployeeBalance {
  orgUsd: number;
  localCurrency: string;
  localAmount: number;
  exchangeRate: number;
  lastUpdated: Date;
}

interface UseEmployeePortalReturn {
  transactions: EmployeeTransaction[];
  balance: EmployeeBalance | null;
  isLoading: boolean;
  error: string | null;
  selectedCurrency: string;
  setSelectedCurrency: (currency: string) => void;
  refreshData: () => Promise<void>;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  filteredTransactions: EmployeeTransaction[];
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

// Generate realistic mock transaction data
function generateMockTransactions(): EmployeeTransaction[] {
  const baseTxHashes = [
    'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
    'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567a',
    'c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567ab2',
    'd4e5f6789012345678901234567890abcdef1234567890abcdef1234567abc34',
    'e5f6789012345678901234567890abcdef1234567890abcdef1234567abcd456',
    'f6789012345678901234567890abcdef1234567890abcdef1234567abcde5678',
    '78901234567890abcdef1234567890abcdef1234567abcde567890abcdef1234',
    '89012345678901234567890abcdef1234567890abcdef567890abcdef12345678',
    '90123456789012345678901234567890abcdef1234567890abcdef1234567890a',
    '01234567890123456789012345678901234567890abcdef1234567890abcdef12',
    '1234567890abcdef0123456789012345678901234567890abcdef1234567890ab',
    '23456789abcdef01234567890123456789012345678901234567890abcdef1234',
  ];

  const orgWallet = 'GBZH...EMPLOYER';
  const memos = [
    'Salary Jan 2026',
    'Salary Feb 2026',
    'Salary Mar 2026',
    'Salary Apr 2026',
    'Salary May 2026',
    'Salary Jun 2026',
    'Q1 Performance Bonus',
    'Q2 Performance Bonus',
    'Travel Reimbursement',
    'WFH Equipment Allow.',
    'Salary Jul 2026',
    'Salary Aug 2026',
  ];

  const types: ('salary' | 'bonus' | 'reimbursement')[] = [
    'salary',
    'salary',
    'salary',
    'salary',
    'salary',
    'salary',
    'bonus',
    'bonus',
    'reimbursement',
    'reimbursement',
    'salary',
    'salary',
  ];

  const amounts = [2500, 2500, 2500, 2500, 2500, 2500, 800, 1200, 350, 150, 2650, 2650];

  const statuses: ('completed' | 'pending' | 'failed')[] = [
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
    'pending',
    'completed',
  ];

  return baseTxHashes.map((hash, i) => {
    const date = new Date(2026, Math.floor(i / 2), 25 + (i % 3));
    return {
      id: `tx-${i + 1}`,
      txHash: hash,
      date: date.toISOString(),
      amount: amounts[i],
      assetCode: 'ORGUSD',
      from: orgWallet,
      memo: memos[i],
      status: statuses[i],
      type: types[i],
      stellarExpertUrl: getStellarExpertLink(hash),
    };
  });
}

const ITEMS_PER_PAGE = 8;

export function useEmployeePortal(): UseEmployeePortalReturn {
  const [transactions, setTransactions] = useState<EmployeeTransaction[]>([]);
  const [balance, setBalance] = useState<EmployeeBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState('NGN');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Load transactions
      const txs = generateMockTransactions();
      setTransactions(txs);

      // Calculate total balance from completed transactions
      const totalOrgUsd = txs
        .filter((tx) => tx.status === 'completed')
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Fetch exchange rates
      const rates = await fetchExchangeRates();
      const rate = rates[selectedCurrency] || 1;

      setBalance({
        orgUsd: totalOrgUsd,
        localCurrency: selectedCurrency,
        localAmount: totalOrgUsd * rate,
        exchangeRate: rate,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCurrency]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filterStatus !== 'all' && tx.status !== filterStatus) return false;
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        tx.txHash.toLowerCase().includes(q) ||
        tx.memo.toLowerCase().includes(q) ||
        tx.amount.toString().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

  // Paginated slice
  const paginatedTransactions = filteredTransactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return {
    transactions: paginatedTransactions,
    balance,
    isLoading,
    error,
    selectedCurrency,
    setSelectedCurrency: (currency: string) => {
      setSelectedCurrency(currency);
      setCurrentPage(1);
    },
    refreshData: loadData,
    currentPage,
    setCurrentPage,
    totalPages,
    filteredTransactions: paginatedTransactions,
    filterStatus,
    setFilterStatus: (status: string) => {
      setFilterStatus(status);
      setCurrentPage(1);
    },
    filterType,
    setFilterType: (type: string) => {
      setFilterType(type);
      setCurrentPage(1);
    },
    searchQuery,
    setSearchQuery,
  };
}
