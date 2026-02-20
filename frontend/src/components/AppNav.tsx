import React from "react";
import { NavLink } from "react-router-dom";
import { Code, User, Wallet } from "lucide-react";
import { Avatar } from "./Avatar";

const AppNav: React.FC = () => {
    // Mock user data - replace with actual user context
    const currentUser = {
        email: "user@example.com",
        name: "John Doe",
        imageUrl: undefined,
    };

    return (
        <nav className="flex items-center gap-8">
            <NavLink
                to="/payroll"
                className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${isActive
                        ? "text-[var(--accent)] bg-white/5"
                        : "text-[var(--muted)] hover:bg-white/10 hover:text-white"
                    }`
                }
            >
                <span className="opacity-70">
                    <Wallet className="w-4 h-4" />
                </span>
                Payroll
            </NavLink>

            <NavLink
                to="/employee"
                className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${isActive
                        ? "text-[var(--accent)] bg-white/5"
                        : "text-[var(--muted)] hover:bg-white/10 hover:text-white"
                    }`
                }
            >
                <span className="opacity-70">
                    <User className="w-4 h-4" />
                </span>
                Employees
            </NavLink>

            <div className="w-px h-5 bg-[var(--border-hi)] mx-2" />

            <NavLink
                to="/debug"
                className={({ isActive }) =>
                    `flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-wide border transition ${isActive
                        ? "text-[var(--accent2)] bg-[rgba(124,111,247,0.06)] border-[rgba(124,111,247,0.25)]"
                        : "text-[var(--accent2)] bg-[rgba(124,111,247,0.06)] border-[rgba(124,111,247,0.25)] hover:bg-[rgba(124,111,247,0.12)]"
                    }`
                }
            >
                <Code className="w-4 h-4" />
                debugger
            </NavLink>


            <div className="mb-2 p-1 bg-gray-50 rounded-lg flex items-center gap-2">
                <Avatar
                    email={currentUser.email}
                    name={currentUser.name}
                    imageUrl={currentUser.imageUrl}
                    size="md"
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                        {currentUser.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                </div>
            </div>

        </nav>
    );
};

export default AppNav;