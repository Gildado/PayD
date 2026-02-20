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
        if (!wallet) return "";
        return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
    };

    return (
        <div className="w-full card glass noise overflow-hidden p-0">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-hi">
                        <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted">Employee</th>
                        <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted">Role</th>
                        <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted">Wallet Address</th>
                        <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted">Status</th>
                        <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {employees.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-6 text-center text-gray-500">
                                No employees found
                            </td>
                        </tr>
                    ) : (
                        employees.map((employee) => (
                            <tr
                                key={employee.id}
                                onClick={() => onEmployeeClick?.(employee)}
                                className="cursor-pointer transition"
                            >
                                <td className="p-6">
                                    <div className="flex items-center gap-3">
                                        <Avatar
                                            email={employee.email}
                                            name={employee.name}
                                            imageUrl={employee.imageUrl}
                                            size="sm"
                                        />
                                        <span className="text-xs text-muted">
                                            {employee.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-6 text-sm font-medium">
                                    {employee.position}
                                </td>
                                <td className="p-6 font-mono text-xs text-muted">
                                    {shortenWallet(employee.wallet || "")}
                                </td>
                                <td className="p-6">
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${employee.status === "Active"
                                            ? "bg-green-100 text-green-600 border-green-200"
                                            : "bg-red-100 text-red-600 border-red-200"
                                            }`}
                                    >
                                        <div
                                            className={`w-1 h-1 rounded-full ${employee.status === "Active"
                                                ? "bg-green-600"
                                                : "bg-red-600"
                                                }`}
                                        />
                                        {employee.status || "-"}
                                    </span>
                                </td>
                                <td className="p-6">
                                    <button className="text-muted hover:text-text transition-colors">
                                        <Icon.Settings01 size="sm" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
                 <div className="p-6 w-full flex flex-col items-center justify-center text-center bg-black/10">
                    <p className="text-muted mb-4 font-medium">Need to migrate your legacy payroll system?</p>
                    <button className="text-accent font-bold text-sm hover:underline">Import from CSV (Coming Soon)</button>
                </div>
        </div>
    );
};