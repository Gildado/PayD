import React, { useState } from 'react';
import { Avatar } from './Avatar';
import { Icon } from '@stellar/design-system';
import { CSVUploader } from './CSVUploader';
import type { CSVRow } from './CSVUploader';
import { Pencil, Trash2 } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  position: string;
  wallet?: string;
  salary?: number;
  status?: 'Active' | 'Inactive';
}

interface EmployeeListProps {
  employees: Employee[];
  onEmployeeClick?: (employee: Employee) => void;
  onAddEmployee?: (employee: Employee) => void;
  onEditEmployee?: (employee: Employee) => void;
  onRemoveEmployee?: (id: string) => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  onEmployeeClick,
  onAddEmployee,
  onEditEmployee,
  onRemoveEmployee,
}) => {
  const [csvData, setCsvData] = useState<Employee[]>([]);
  const [showCSVUploader, setShowCSVUploader] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<{ open: boolean; employee?: Employee }>({
    open: false,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ open: boolean; id?: string }>({
    open: false,
  });
  const [sortKey, setSortKey] = useState<keyof Employee>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [newEmployee, setNewEmployee] = useState<Employee>({
    id: '',
    name: '',
    email: '',
    position: '',
    wallet: '',
    salary: 0,
    status: 'Active',
  });
  const [editSalary, setEditSalary] = useState<number>(0);

  const handleAddModalSubmit = () => {
    onAddEmployee?.({
      ...newEmployee,
      id: String(Date.now() + Math.random()),
    });
    setNewEmployee({
      id: '',
      name: '',
      email: '',
      position: '',
      wallet: '',
      salary: 0,
      status: 'Active',
    });
    setShowAddModal(false);
  };

  const handleEditModalSubmit = () => {
    if (showEditModal.employee && onEditEmployee) {
      onEditEmployee({
        ...showEditModal.employee,
        salary: editSalary,
      });
    }
    setShowEditModal({ open: false });
  };

  const handleDeleteConfirm = () => {
    if (showDeleteConfirm.id && onRemoveEmployee) {
      onRemoveEmployee(showDeleteConfirm.id);
    }
    setShowDeleteConfirm({ open: false });
  };

  const handleDataParsed = (data: CSVRow[]) => {
    const newEmployees = data.map((row) => ({
      id: String(Date.now() + Math.random()),
      name: row.data.name,
      email: row.data.email,
      wallet: row.data.wallet,
      position: row.data.position,
      salary: Number(row.data.salary) || 0,
      status: (row.data.status as 'Active' | 'Inactive') || 'Active',
    }));
    setCsvData(newEmployees);
  };

  const handleAddEmployees = () => {
    csvData.forEach((employee) => {
      onAddEmployee?.(employee);
    });
    setCsvData([]);
    setShowCSVUploader(false);
  };

  const handleSort = (key: keyof Employee) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedEmployees = [...employees].sort((a, b) => {
    const valA = a[sortKey] ?? '';
    const valB = b[sortKey] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const shortenWallet = (wallet: string) => {
    if (!wallet) return "—";
    return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
  };

  const StatusBadge: React.FC<{ status?: string }> = ({ status }) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${status === "Active"
        ? "bg-green-950/60 text-green-400 border-green-800/60"
        : "bg-red-950/60 text-red-400 border-red-800/60"
        }`}
    >
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status === "Active" ? "bg-green-400" : "bg-red-400"
          }`}
      />
      {status ?? "—"}
    </span>
  );

  return (
    <div className="w-full card glass noise overflow-hidden p-0">
      {/* ── Desktop / tablet table (hidden on xs) ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-(--border-hi)">
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-(--muted)">
                Employee
              </th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-(--muted)">
                Role
              </th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-(--muted)">
                Wallet
              </th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-(--muted)">
                Status
              </th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-(--muted)">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--border)">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-(--muted)">
                  No employees found
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr
                  key={employee.id}
                  onClick={() => onEmployeeClick?.(employee)}
                  className="cursor-pointer transition hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        email={employee.email}
                        name={employee.name}
                        imageUrl={employee.imageUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-(--text) truncate">
                          {employee.name}
                        </p>
                        <p className="text-xs text-(--muted) truncate">
                          {employee.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-(--text)">
                    {employee.position}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-(--muted)">
                    {shortenWallet(employee.wallet ?? "")}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={employee.status} />
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className="touch-target flex items-center justify-center w-9 h-9 rounded-lg text-(--muted) hover:text-(--text) hover:bg-white/10 transition-all"
                      aria-label={`Settings for ${employee.name}`}
                    >
                      <Icon.Settings01 size="sm" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile card stack (visible only on xs) ── */}
      <div className="sm:hidden flex flex-col divide-y divide-(--border)">
        {employees.length === 0 ? (
          <p className="px-5 py-10 text-center text-(--muted) text-sm">
            No employees found
          </p>
        ) : (
          employees.map((employee) => (
            <div
              key={employee.id}
              onClick={() => onEmployeeClick?.(employee)}
              className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-white/[0.02] transition active:bg-white/[0.04]"
            >
              <Avatar
                email={employee.email}
                name={employee.name}
                imageUrl={employee.imageUrl}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-(--text) truncate">
                    {employee.name}
                  </p>
                  <StatusBadge status={employee.status} />
                </div>
                <p className="text-xs text-(--muted) truncate">
                  {employee.position}
                </p>
                <p className="text-[10px] font-mono text-(--muted) mt-0.5 truncate">
                  {shortenWallet(employee.wallet ?? "")}
                </p>
              </div>
              <button
                className="flex-shrink-0 touch-target flex items-center justify-center w-10 h-10 rounded-lg text-(--muted) hover:text-(--text) hover:bg-white/10 transition-all"
                aria-label={`Settings for ${employee.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Icon.Settings01 size="sm" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* CSV footer */}
      <div className="px-5 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-center bg-black/10 border-t border-(--border)">
        <p className="text-(--muted) font-medium text-sm">
          Need to migrate your legacy payroll system?
        </p>
        {!showCSVUploader && (
          <button
            className="text-(--accent) font-bold text-sm hover:underline"
            onClick={() => setShowCSVUploader(true)}
          >
            Import from CSV
          </button>
        )}
        {showCSVUploader && (
          <div className="w-full max-w-2xl mx-auto mt-2">
            <CSVUploader
              requiredColumns={['name', 'email', 'wallet', 'position', 'salary', 'status']}
              onDataParsed={handleDataParsed}
            />
            <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={handleAddEmployees}
                className="px-4 py-2 bg-(--accent) text-bg rounded-lg font-medium"
                disabled={csvData.length === 0}
              >
                Add Employees from CSV
              </button>
              <button
                onClick={() => {
                  setShowCSVUploader(false);
                  setCsvData([]);
                }}
                className="px-4 py-2 glass border border-(--border-hi) rounded-lg text-(--muted) hover:text-(--text)"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Add Employee</h2>
            <input
              type="text"
              placeholder="Name"
              value={newEmployee.name}
              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
              className="w-full mb-2 px-3 py-2 border rounded"
            />
            <input
              type="email"
              placeholder="Email"
              value={newEmployee.email}
              onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
              className="w-full mb-2 px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="Wallet"
              value={newEmployee.wallet}
              onChange={(e) => setNewEmployee({ ...newEmployee, wallet: e.target.value })}
              className="w-full mb-2 px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="Position"
              value={newEmployee.position}
              onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
              className="w-full mb-2 px-3 py-2 border rounded"
            />
            <input
              type="number"
              placeholder="Salary"
              value={newEmployee.salary}
              onChange={(e) => setNewEmployee({ ...newEmployee, salary: Number(e.target.value) })}
              className="w-full mb-2 px-3 py-2 border rounded"
            />
            <select
              value={newEmployee.status}
              onChange={(e) =>
                setNewEmployee({ ...newEmployee, status: e.target.value as 'Active' | 'Inactive' })
              }
              className="w-full mb-4 px-3 py-2 border rounded"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAddModalSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {showEditModal.open && showEditModal.employee && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Edit Salary</h2>
            <div className="mb-4">
              <span className="font-semibold">{showEditModal.employee.name}</span>
              <span className="ml-2 text-xs text-muted">{showEditModal.employee.position}</span>
            </div>
            <input
              type="number"
              value={editSalary}
              onChange={(e) => setEditSalary(Number(e.target.value))}
              className="w-full mb-4 px-3 py-2 border rounded"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEditModal({ open: false })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleEditModalSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirm */}
      {showDeleteConfirm.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Confirm Removal</h2>
            <p className="mb-4">Are you sure you want to remove this employee?</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm({ open: false })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
