import React, { useState } from 'react';
import { Avatar } from './Avatar';
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
  onAddEmployee: (employee: Employee) => void;
  onEditEmployee?: (employee: Employee) => void;
  onRemoveEmployee?: (id: string) => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
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
      onAddEmployee(employee);
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
    if (!wallet) return '';
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  // Add Modal (simple inline for demo)
  const [newEmployee, setNewEmployee] = useState<Employee>({
    id: '',
    name: '',
    email: '',
    position: '',
    wallet: '',
    salary: 0,
    status: 'Active',
  });

  const handleAddModalSubmit = () => {
    onAddEmployee({
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

  // Edit Modal (simple inline for demo)
  const [editSalary, setEditSalary] = useState<number>(0);

  const handleEditModalSubmit = () => {
    if (showEditModal.employee && onEditEmployee) {
      onEditEmployee({
        ...showEditModal.employee,
        salary: editSalary,
      });
    }
    setShowEditModal({ open: false });
  };

  // Delete Confirm
  const handleDeleteConfirm = () => {
    if (showDeleteConfirm.id && onRemoveEmployee) {
      onRemoveEmployee(showDeleteConfirm.id);
    }
    setShowDeleteConfirm({ open: false });
  };

  return (
    <div className="w-full card glass noise overflow-hidden p-0">
      <div className="flex justify-between items-center p-6">
        <span className="font-bold text-lg">Employees</span>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-hi">
            <th
              className="p-6 text-xs font-bold uppercase tracking-widest text-muted cursor-pointer"
              onClick={() => handleSort('name')}
            >
              Name {sortKey === 'name' && (sortAsc ? '▲' : '▼')}
            </th>
            <th
              className="p-6 text-xs font-bold uppercase tracking-widest text-muted cursor-pointer"
              onClick={() => handleSort('position')}
            >
              Role {sortKey === 'position' && (sortAsc ? '▲' : '▼')}
            </th>
            <th
              className="p-6 text-xs font-bold uppercase tracking-widest text-muted cursor-pointer"
              onClick={() => handleSort('wallet')}
            >
              Wallet {sortKey === 'wallet' && (sortAsc ? '▲' : '▼')}
            </th>
            <th
              className="p-6 text-xs font-bold uppercase tracking-widest text-muted cursor-pointer"
              onClick={() => handleSort('salary')}
            >
              Salary {sortKey === 'salary' && (sortAsc ? '▲' : '▼')}
            </th>
            <th
              className="p-6 text-xs font-bold uppercase tracking-widest text-muted cursor-pointer"
              onClick={() => handleSort('status')}
            >
              Status {sortKey === 'status' && (sortAsc ? '▲' : '▼')}
            </th>
            <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedEmployees.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-6 text-center text-gray-500">
                No employees found
              </td>
            </tr>
          ) : (
            sortedEmployees.map((employee) => (
              <tr key={employee.id} className="cursor-pointer transition">
                <td className="p-6">
                  <div className="flex items-center gap-3">
                    <Avatar
                      email={employee.email}
                      name={employee.name}
                      imageUrl={employee.imageUrl}
                      size="sm"
                    />
                    <span className="text-xs text-muted">{employee.name}</span>
                  </div>
                </td>
                <td className="p-6 text-sm font-medium">{employee.position}</td>
                <td className="p-6 font-mono text-xs text-muted">
                  {shortenWallet(employee.wallet || '')}
                </td>
                <td className="p-6">
                  {/* Inline salary edit */}
                  {onEditEmployee ? (
                    <button
                      className="text-blue-500 underline"
                      onClick={() => {
                        setEditSalary(employee.salary || 0);
                        setShowEditModal({ open: true, employee });
                      }}
                    >
                      {employee.salary ?? 0}
                    </button>
                  ) : (
                    (employee.salary ?? 0)
                  )}
                </td>
                <td className="p-6">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      employee.status === 'Active'
                        ? 'bg-green-100 text-green-600 border-green-200'
                        : 'bg-red-100 text-red-600 border-red-200'
                    }`}
                  >
                    <div
                      className={`w-1 h-1 rounded-full ${
                        employee.status === 'Active' ? 'bg-green-600' : 'bg-red-600'
                      }`}
                    />
                    {employee.status || '-'}
                  </span>
                </td>
                <td className="p-6 flex gap-2">
                  <button
                    className="text-blue-500 hover:text-blue-700"
                    title="Edit"
                    onClick={() => {
                      setEditSalary(employee.salary || 0);
                      setShowEditModal({ open: true, employee });
                    }}
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    className="text-red-500 hover:text-red-700"
                    title="Remove"
                    onClick={() => setShowDeleteConfirm({ open: true, id: employee.id })}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* CSV Import */}
      <div className="p-6 w-full flex flex-col items-center justify-center text-center bg-black/10">
        <p className="text-muted mb-4 font-medium">Need to migrate your legacy payroll system?</p>
        {!showCSVUploader && (
          <button
            className="text-accent font-bold text-sm hover:underline"
            onClick={() => setShowCSVUploader(true)}
          >
            Import from CSV
          </button>
        )}
        {showCSVUploader && (
          <div className="w-full max-w-2xl mx-auto">
            <CSVUploader
              requiredColumns={['name', 'email', 'wallet', 'position', 'salary', 'status']}
              onDataParsed={handleDataParsed}
            />
            <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={handleAddEmployees}
                className="px-4 py-2 bg-blue-500 text-white rounded"
                disabled={csvData.length === 0}
              >
                Add Employees from CSV
              </button>
              <button
                onClick={() => {
                  setShowCSVUploader(false);
                  setCsvData([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
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
