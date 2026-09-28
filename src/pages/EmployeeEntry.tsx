import React, { useState } from "react";
import { Button, Card, Icon, Input } from "@stellar/design-system";
import { EmployeeList, Employee } from "../components/EmployeeList";

const initialEmployees: Employee[] = [
  {
    id: "1",
    name: "Wilfred G.",
    email: "wilfred@example.com",
    position: "Lead Developer",
    wallet: "GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6",
    salary: 5000,
    status: "Active",
  },
  {
    id: "2",
    name: "Chinelo A.",
    email: "chinelo@example.com",
    position: "Product Manager",
    wallet: "GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6",
    salary: 4500,
    status: "Active",
  },
  {
    id: "3",
    name: "Emeka N.",
    email: "emeka@example.com",
    position: "UX Designer",
    wallet: "GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6",
    salary: 3800,
    status: "Active",
  },
];

export default function EmployeeEntry() {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
    status: "Active",
    salary: 0,
  });

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const id = (employees.length + 1).toString();
    const employeeToAdd = {
      ...newEmployee,
      id,
    } as Employee;

    setEmployees([...employees, employeeToAdd]);
    setShowAddModal(false);
    setNewEmployee({ status: "Active", salary: 0 });
  };

  const handleRemove = (id: string) => {
    setEmployees(employees.filter((e) => e.id !== id));
  };

  const handleUpdateSalary = (id: string, newSalary: number) => {
    setEmployees(
      employees.map((e) => (e.id === id ? { ...e, salary: newSalary } : e)),
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-6xl mx-auto w-full min-h-screen">
      <div className="w-full mb-12 flex items-end justify-between border-b border-gray-100 pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            Workforce <span className="text-accent">Directory</span>
          </h1>
          <p className="text-gray-400 font-mono text-xs tracking-widest uppercase">
            Manage your global team on-chain
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowAddModal(true)}
          className="!bg-accent !text-white flex items-center gap-2"
        >
          <Icon.Plus size="sm" />
          Add Employee
        </Button>
      </div>

      <EmployeeList
        employees={employees}
        onRemove={handleRemove}
        onUpdateSalary={handleUpdateSalary}
      />

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full p-8 space-y-6 shadow-2xl scale-in-center">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Add New Employee</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icon.XClose size="sm" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="John Doe"
                required
                value={newEmployee.name || ""}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, name: e.target.value })
                }
              />
              <Input
                label="Email Address"
                placeholder="john@company.com"
                type="email"
                required
                value={newEmployee.email || ""}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, email: e.target.value })
                }
              />
              <Input
                label="Position"
                placeholder="Software Engineer"
                required
                value={newEmployee.position || ""}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, position: e.target.value })
                }
              />
              <Input
                label="Stellar Wallet Address"
                placeholder="GD..."
                required
                value={newEmployee.wallet || ""}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, wallet: e.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Salary (USDC)"
                  type="number"
                  required
                  value={newEmployee.salary?.toString() || "0"}
                  onChange={(e) =>
                    setNewEmployee({
                      ...newEmployee,
                      salary: parseFloat(e.target.value),
                    })
                  }
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    className="w-full border border-gray-200 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-accent outline-none"
                    value={newEmployee.status}
                    onChange={(e) =>
                      setNewEmployee({
                        ...newEmployee,
                        status: e.target.value as "Active" | "Inactive",
                      })
                    }
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  variant="tertiary"
                  size="md"
                  className="flex-1"
                  type="button"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1 !bg-accent"
                  type="submit"
                >
                  Save Employee
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
