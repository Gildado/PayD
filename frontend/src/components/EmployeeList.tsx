import React from "react";
import { Avatar } from "./Avatar";
import { Icon } from "@stellar/design-system";

interface Employee {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  position: string;
  wallet?: string;
  status?: "Active" | "Inactive";
}

interface EmployeeListProps {
  employees: Employee[];
  onEmployeeClick?: (employee: Employee) => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  onEmployeeClick,
}) => {
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
            <tr className="border-b border-[var(--border-hi)]">
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
                Employee
              </th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
                Role
              </th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
                Wallet
              </th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
                Status
              </th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[var(--muted)]">
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
                        <p className="text-sm font-medium text-[var(--text)] truncate">
                          {employee.name}
                        </p>
                        <p className="text-xs text-[var(--muted)] truncate">
                          {employee.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-[var(--text)]">
                    {employee.position}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-[var(--muted)]">
                    {shortenWallet(employee.wallet ?? "")}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={employee.status} />
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className="touch-target flex items-center justify-center w-9 h-9 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/10 transition-all"
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
      <div className="sm:hidden flex flex-col divide-y divide-[var(--border)]">
        {employees.length === 0 ? (
          <p className="px-5 py-10 text-center text-[var(--muted)] text-sm">
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
                  <p className="text-sm font-semibold text-[var(--text)] truncate">
                    {employee.name}
                  </p>
                  <StatusBadge status={employee.status} />
                </div>
                <p className="text-xs text-[var(--muted)] truncate">
                  {employee.position}
                </p>
                <p className="text-[10px] font-mono text-[var(--muted)] mt-0.5 truncate">
                  {shortenWallet(employee.wallet ?? "")}
                </p>
              </div>
              <button
                className="flex-shrink-0 touch-target flex items-center justify-center w-10 h-10 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/10 transition-all"
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
      <div className="px-5 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-center bg-black/10 border-t border-[var(--border)]">
        <p className="text-[var(--muted)] font-medium text-sm">
          Need to migrate your legacy payroll system?
        </p>
        <button className="text-[var(--accent)] font-bold text-sm hover:underline">
          Import from CSV (Coming Soon)
        </button>
      </div>
    </div>
  );
};
