import React, { useState } from "react";
import { Button, Card, Icon } from "@stellar/design-system";

export interface Employee {
  id: string;
  name: string;
  email: string;
  wallet: string;
  salary: number;
  status: "Active" | "Inactive";
  position: string;
}

interface EmployeeListProps {
  employees: Employee[];
  onRemove: (id: string) => void;
  onUpdateSalary: (id: string, newSalary: number) => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  onRemove,
  onUpdateSalary,
}) => {
  const [sortField, setSortField] = useState<keyof Employee>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSort = (field: keyof Employee) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedEmployees = [...employees].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();

    if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
    if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const startEditing = (employee: Employee) => {
    setEditingId(employee.id);
    setEditValue(employee.salary.toString());
  };

  const saveSalary = (id: string) => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      onUpdateSalary(id, numValue);
    }
    setEditingId(null);
  };

  return (
    <Card className="w-full overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              {[
                { label: "Name", field: "name" as keyof Employee },
                { label: "Position", field: "position" as keyof Employee },
                { label: "Stellar Wallet", field: "wallet" as keyof Employee },
                { label: "Salary (USDC)", field: "salary" as keyof Employee },
                { label: "Status", field: "status" as keyof Employee },
              ].map((col) => (
                <th
                  key={col.field}
                  className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-500 cursor-pointer hover:text-accent transition-colors"
                  onClick={() => handleSort(col.field)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {sortField === col.field && (
                      <Icon.ChevronDown
                        size="xs"
                        className={`transition-transform ${sortDirection === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </div>
                </th>
              ))}
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedEmployees.map((emp) => (
              <tr
                key={emp.id}
                className="hover:bg-gray-50/30 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">{emp.name}</div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {emp.email}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {emp.position}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                    <Icon.Key size="xs" />
                    {emp.wallet.slice(0, 6)}...{emp.wallet.slice(-4)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {editingId === emp.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-24 px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-accent outline-none"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        onBlur={() => saveSalary(emp.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && saveSalary(emp.id)
                        }
                      />
                    </div>
                  ) : (
                    <div
                      className="group flex items-center gap-2 cursor-pointer hover:text-accent font-bold"
                      onClick={() => startEditing(emp)}
                    >
                      {emp.salary.toLocaleString()}
                      <Icon.Edit02
                        size="xs"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      emp.status === "Active"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-red-100 text-red-700 border-red-200"
                    }`}
                  >
                    <div
                      className={`w-1 h-1 rounded-full ${
                        emp.status === "Active" ? "bg-green-600" : "bg-red-600"
                      }`}
                    />
                    {emp.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      onClick={() => setConfirmDeleteId(emp.id)}
                      title="Remove Employee"
                    >
                      <Icon.Trash01 size="sm" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Overlay (Custom UI) */}
      {confirmDeleteId && (
        <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
              <Icon.AlertTriangle size="md" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Remove Employee?</h3>
              <p className="text-sm text-gray-500">
                This action cannot be undone. All scheduled payments for this
                employee will be cancelled.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="tertiary"
                size="md"
                className="flex-1"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1 !bg-red-600 !border-red-600"
                onClick={() => {
                  onRemove(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
