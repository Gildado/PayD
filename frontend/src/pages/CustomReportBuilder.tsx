import { useState, useMemo } from "react";
import { Button, Card, Icon } from "@stellar/design-system";

// Define all possible columns for the report
type ReportColumn = {
  id: string;
  label: string;
};

const ALL_COLUMNS: ReportColumn[] = [
  { id: "worker_id", label: "Worker ID" },
  { id: "amount", label: "Amount" },
  { id: "asset", label: "Asset" },
  { id: "setup_date", label: "Stream Setup Date" },
  { id: "payout_date", label: "Expected Payout Date" },
  { id: "status", label: "Status" },
];

// Mock data (matching the columns)
const MOCK_DATA = [
  {
    worker_id: "W-1001",
    amount: "500.00",
    asset: "USDC",
    setup_date: "2026-02-01",
    payout_date: "2026-02-15",
    status: "Paid",
  },
  {
    worker_id: "W-1002",
    amount: "750.00",
    asset: "USDC",
    setup_date: "2026-02-01",
    payout_date: "2026-02-15",
    status: "Paid",
  },
  {
    worker_id: "W-1003",
    amount: "1200.00",
    asset: "XLM",
    setup_date: "2026-02-05",
    payout_date: "2026-02-28",
    status: "Pending",
  },
  {
    worker_id: "W-1004",
    amount: "400.00",
    asset: "USDC",
    setup_date: "2026-02-10",
    payout_date: "2026-02-28",
    status: "Pending",
  },
  {
    worker_id: "W-1005",
    amount: "3000.00",
    asset: "XLM",
    setup_date: "2026-01-15",
    payout_date: "2026-01-31",
    status: "Paid",
  },
];

const CustomReportBuilder = () => {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    ALL_COLUMNS.map((c) => c.id),
  );
  const [startDate, setStartDate] = useState<string>("2026-02-01");
  const [endDate, setEndDate] = useState<string>("2026-02-28");

  const toggleColumn = (colId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colId)
        ? prev.filter((id) => id !== colId)
        : [...prev, colId],
    );
  };

  const activeColumns = ALL_COLUMNS.filter((c) =>
    selectedColumns.includes(c.id),
  );

  // Filter data by date range
  const filteredData = useMemo(() => {
    return MOCK_DATA.filter((row) => {
      const rowDate = new Date(row.setup_date);
      const start = startDate ? new Date(startDate) : new Date("2000-01-01");
      const end = endDate ? new Date(endDate) : new Date("2100-01-01");
      return rowDate >= start && rowDate <= end;
    });
  }, [startDate, endDate]);

  const handleExport = () => {
    // Simulate export logic (e.g. converting filteredData to CSV and triggering download)
    alert(
      `Exporting ${filteredData.length} records with columns: ${activeColumns.map((c) => c.label).join(", ")}`,
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Custom Report Builder
        </h1>
        <p className="text-gray-600">
          Select columns and date ranges to preview and export custom payroll
          data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Controls Sidebar */}
        <div className="md:col-span-1 space-y-6 flex flex-col">
          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">
                Date Range
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 bg-white text-gray-800"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 bg-white text-gray-800"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Columns</h3>
              <div className="space-y-2">
                {ALL_COLUMNS.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center space-x-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300"
                      checked={selectedColumns.includes(col.id)}
                      onChange={() => toggleColumn(col.id)}
                    />
                    <span className="text-gray-700 text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          <Button
            onClick={handleExport}
            variant="primary"
            size="md"
            className="w-full flex justify-center mt-auto"
          >
            <Icon.DownloadCloud01 className="mr-2" />
            Export Data
          </Button>
        </div>

        {/* Live Preview Pane */}
        <div className="md:col-span-3">
          <Card>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-xl">Live Preview</h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {filteredData.length} records found
                </span>
              </div>

              <div className="overflow-x-auto">
                {activeColumns.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {activeColumns.map((col) => (
                          <th
                            key={col.id}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredData.map((row) => (
                        <tr key={row.worker_id} className="hover:bg-gray-50">
                          {activeColumns.map((col) => (
                            <td
                              key={col.id}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                            >
                              {row[col.id as keyof typeof row]}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {filteredData.length === 0 && (
                        <tr>
                          <td
                            colSpan={activeColumns.length}
                            className="px-6 py-8 text-center text-gray-500"
                          >
                            No data found for the selected date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                    Please select at least one column to preview data.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomReportBuilder;
