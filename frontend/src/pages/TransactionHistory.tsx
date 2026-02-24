import { useState, useMemo } from 'react';
import { Search, Filter, Calendar, X, Activity, User, Tag } from 'lucide-react';

// Mock data
const mockTransactions = [
  {
    id: 'TXN-1001',
    employeeName: 'Wilfred G.',
    category: 'Salary',
    date: '2026-02-15',
    amount: '5000.00',
    currency: 'USDC',
    status: 'Completed',
  },
  {
    id: 'TXN-1002',
    employeeName: 'Chinelo A.',
    category: 'Bonus',
    date: '2026-02-10',
    amount: '1500.00',
    currency: 'USDC',
    status: 'Completed',
  },
  {
    id: 'TXN-1003',
    employeeName: 'Jane Smith',
    category: 'Expense',
    date: '2026-02-05',
    amount: '250.00',
    currency: 'XLM',
    status: 'Pending',
  },
  {
    id: 'TXN-1004',
    employeeName: 'Emeka N.',
    category: 'Salary',
    date: '2026-01-31',
    amount: '4200.00',
    currency: 'EURC',
    status: 'Completed',
  },
  {
    id: 'TXN-1005',
    employeeName: 'Fatima K.',
    category: 'Expense',
    date: '2026-01-28',
    amount: '80.00',
    currency: 'USDC',
    status: 'Failed',
  },
  {
    id: 'TXN-1006',
    employeeName: 'Wilfred G.',
    category: 'Bonus',
    date: '2026-01-15',
    amount: '1000.00',
    currency: 'USDC',
    status: 'Completed',
  },
];

const CATEGORIES = ['Salary', 'Bonus', 'Expense'];
const EMPLOYEES = ['Wilfred G.', 'Chinelo A.', 'Jane Smith', 'Emeka N.', 'Fatima K.'];

export default function TransactionHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Active filters array for tags
  const activeFilters = useMemo(() => {
    const filters: { type: string; value: string; label: string }[] = [];
    if (searchTerm)
      filters.push({ type: 'search', value: searchTerm, label: `Search: ${searchTerm}` });
    selectedCategories.forEach((c) =>
      filters.push({ type: 'category', value: c, label: `Category: ${c}` })
    );
    selectedEmployees.forEach((e) =>
      filters.push({ type: 'employee', value: e, label: `Employee: ${e}` })
    );
    if (dateRange.start)
      filters.push({
        type: 'dateStart',
        value: dateRange.start,
        label: `From: ${dateRange.start}`,
      });
    if (dateRange.end)
      filters.push({ type: 'dateEnd', value: dateRange.end, label: `To: ${dateRange.end}` });
    return filters;
  }, [searchTerm, selectedCategories, selectedEmployees, dateRange]);

  const removeFilter = (filter: { type: string; value: string }) => {
    switch (filter.type) {
      case 'search':
        setSearchTerm('');
        break;
      case 'category':
        setSelectedCategories((prev) => prev.filter((c) => c !== filter.value));
        break;
      case 'employee':
        setSelectedEmployees((prev) => prev.filter((e) => e !== filter.value));
        break;
      case 'dateStart':
        setDateRange((prev) => ({ ...prev, start: '' }));
        break;
      case 'dateEnd':
        setDateRange((prev) => ({ ...prev, end: '' }));
        break;
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setSelectedEmployees([]);
    setDateRange({ start: '', end: '' });
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleEmployee = (emp: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(emp) ? prev.filter((e) => e !== emp) : [...prev, emp]
    );
  };

  // Filter logic
  const filteredTransactions = useMemo(() => {
    return mockTransactions.filter((txn) => {
      const matchSearch =
        txn.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory =
        selectedCategories.length === 0 || selectedCategories.includes(txn.category);
      const matchEmployee =
        selectedEmployees.length === 0 || selectedEmployees.includes(txn.employeeName);

      let matchDate = true;
      const txnDate = new Date(txn.date);
      if (dateRange.start) matchDate = matchDate && txnDate >= new Date(dateRange.start);
      if (dateRange.end) matchDate = matchDate && txnDate <= new Date(dateRange.end);

      return matchSearch && matchCategory && matchEmployee && matchDate;
    });
  }, [searchTerm, selectedCategories, selectedEmployees, dateRange]);

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-12 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            Transaction <span className="text-accent">History</span>
          </h1>
          <p className="text-zinc-500 font-mono text-sm tracking-wider uppercase">
            Track and filter all organizational transfers
          </p>
        </div>
        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${isFilterExpanded ? 'bg-accent text-bg' : 'bg-zinc-800/50 text-white hover:bg-zinc-800'}`}
        >
          <Filter size={18} />
          {isFilterExpanded ? 'Hide Filters' : 'Advanced Filters'}
        </button>
      </div>

      {/* Expanded Filter Header */}
      {isFilterExpanded && (
        <div className="bg-[#16161a] border border-zinc-800 rounded-xl p-6 mb-8 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Search */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="ID or Employee Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-accent outline-none transition-all"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                    className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg py-2 pl-8 pr-2 text-xs focus:ring-1 focus:ring-accent outline-none text-zinc-300 custom-date-input"
                  />
                </div>
                <span className="text-zinc-600">-</span>
                <div className="relative flex-1">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                    className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg py-2 pl-8 pr-2 text-xs focus:ring-1 focus:ring-accent outline-none text-zinc-300 custom-date-input"
                  />
                </div>
              </div>
            </div>

            {/* Categories Multi-select */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 transition-all ${selectedCategories.includes(cat) ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-[#0a0a0c] border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                  >
                    <Tag size={12} />
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Employees Multi-select (Dynamic suggestions simulation) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Employees
              </label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-2">
                {EMPLOYEES.map((emp) => (
                  <button
                    key={emp}
                    onClick={() => toggleEmployee(emp)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 transition-all ${selectedEmployees.includes(emp) ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-[#0a0a0c] border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                  >
                    <User size={12} />
                    {emp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Bar */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-4 bg-zinc-900/40 border border-zinc-800/50 rounded-xl">
          <span className="text-xs font-bold uppercase text-zinc-500 mr-2 flex items-center gap-1">
            <Filter size={12} /> Active Filters:
          </span>
          {activeFilters.map((filter) => (
            <span
              key={`${filter.type}-${filter.value}`}
              className="flex items-center gap-1.5 bg-zinc-800 text-xs px-2.5 py-1 rounded-md text-zinc-300 border border-zinc-700"
            >
              {filter.label}
              <button
                onClick={() => removeFilter(filter)}
                className="text-zinc-500 hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs text-blue-400 hover:text-blue-300 underline ml-auto font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-[#16161a] border border-zinc-800 rounded-xl overflow-hidden shadow-xl flex-1 flex flex-col max-h-150 overflow-y-auto custom-scrollbar">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-175">
            <thead className="bg-[#111115] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Txn ID
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Date
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Employee
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Category
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70 text-right">
                  Amount
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((txn, idx) => (
                  <tr
                    key={txn.id}
                    className={`border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-zinc-900/10'}`}
                  >
                    <td className="p-4 font-mono text-sm text-blue-400">{txn.id}</td>
                    <td className="p-4 text-sm text-zinc-400">{txn.date}</td>
                    <td className="p-4 text-sm font-medium">{txn.employeeName}</td>
                    <td className="p-4">
                      <span className="bg-zinc-800/80 text-zinc-300 px-2.5 py-1 rounded-md text-xs border border-zinc-700/50">
                        {txn.category}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold">
                      {txn.amount} <span className="text-zinc-500 text-xs">{txn.currency}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                          txn.status === 'Completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : txn.status === 'Pending'
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <Activity className="w-8 h-8 opacity-20" />
                      <p>No transactions match the selected filters.</p>
                      <button
                        onClick={clearAllFilters}
                        className="text-blue-400 hover:text-blue-300 text-sm mt-2 transition-colors"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 text-xs text-zinc-500 flex justify-between items-center px-2">
        <span>
          Showing {filteredTransactions.length} of {mockTransactions.length} transactions
        </span>
        <span>Filter engine active</span>
      </div>

      {/* Custom Scrollbar & Utility Styles for this page */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
        
        /* Ensures the date chevron and icon blend in dark mode */
        .custom-date-input::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.5);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
