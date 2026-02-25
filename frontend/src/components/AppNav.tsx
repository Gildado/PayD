import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Code, User, Wallet, FileText, Globe, X, Menu, Activity } from "lucide-react";
import { Avatar } from "./Avatar";
import ConnectAccount from "./ConnectAccount";

// ── Mobile Hamburger Button ─────────────────────────────────────────
interface HamburgerProps {
    isOpen: boolean;
    onToggle: () => void;
}

export const HamburgerButton: React.FC<HamburgerProps> = ({ isOpen, onToggle }) => (
    <button
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-nav"
        onClick={onToggle}
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg glass border border-[var(--border-hi)] text-(--muted) hover:text-white hover:border-(--accent)/40 transition-all touch-target"
    >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
    </button>
);

// ── Nav Link Item (shared between desktop & mobile) ─────────────────
interface NavItemProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    isDebug?: boolean;
    onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, isDebug, onClick }) => (
    <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
            isDebug
                ? `flex items-center gap-2 px-3 py-2.5 rounded-lg text-[11px] font-mono tracking-wide border transition touch-target ${isActive
                    ? "text-(--accent2) bg-[rgba(124,111,247,0.10)] border-[rgba(124,111,247,0.35)]"
                    : "text-(--accent2) bg-[rgba(124,111,247,0.06)] border-[rgba(124,111,247,0.20)] hover:bg-[rgba(124,111,247,0.12)] hover:border-[rgba(124,111,247,0.35)]"
                }`
                : `flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition touch-target ${isActive
                    ? "text-(--accent) bg-white/5"
                    : "text-(--muted) hover:bg-white/10 hover:text-white"
                }`
        }
    >
        <span className="opacity-70 flex-shrink-0">{icon}</span>
        {label}
    </NavLink>
);

// ── Desktop Nav (horizontal, hidden on mobile) ──────────────────────
const DesktopNav: React.FC = () => {
    const currentUser = {
        email: "user@example.com",
        name: "John Doe",
        imageUrl: undefined as string | undefined,
    };

    return (
        <nav
            className="hidden md:flex items-center gap-2 lg:gap-4"
            aria-label="Main navigation"
        >
            <NavItem to="/payroll" icon={<Wallet className="w-4 h-4" />} label="Payroll" />
            <NavItem to="/employee" icon={<User className="w-4 h-4" />} label="Employees" />
            <NavItem to="/reports" icon={<FileText className="w-4 h-4" />} label="Reports" />
            <NavItem
                to="/cross-asset-payment"
                icon={<Globe className="w-4 h-4" />}
                label="Cross-Asset"
            />

            <div className="w-px h-5 bg-(--border-hi) mx-1" />

            <NavItem
                to="/debug"
                icon={<Code className="w-4 h-4" />}
                label="debugger"
                isDebug
            />
            <NavItem
                to="/transactions"
                icon={<Activity className="w-4 h-4" />}
                label="History"
            />

            <Link
                to="/help"
                className="text-blue-500 text-[11px] font-medium hover:underline ml-1"
            >
                Need help?
            </Link>

            <div className="ml-2 flex items-center gap-2">
                <ConnectAccount />
            </div>

            <div className="ml-1 pl-2 border-l border-(--border-hi) hidden lg:flex items-center gap-2">
                <Avatar
                    email={currentUser.email}
                    name={currentUser.name}
                    imageUrl={currentUser.imageUrl}
                    size="sm"
                />
                <div className="flex-1 min-w-0 hidden xl:block">
                    <p className="text-xs font-semibold text-(--text) truncate leading-tight">
                        {currentUser.name}
                    </p>
                    <p className="text-[10px] text-(--muted) truncate leading-tight">
                        {currentUser.email}
                    </p>
                </div>
            </div>
        </nav>
    );
};

// ── Mobile Drawer Nav ───────────────────────────────────────────────
interface MobileNavProps {
    isOpen: boolean;
    onClose: () => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
    const currentUser = {
        email: "user@example.com",
        name: "John Doe",
        imageUrl: undefined as string | undefined,
    };

    // Trap scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <nav
                id="mobile-nav"
                role="navigation"
                aria-label="Mobile navigation"
                className={`md:hidden fixed top-0 right-0 h-full z-50 w-[280px] max-w-[85vw] flex flex-col
                    bg-[var(--surface)] border-l border-(--border-hi)
                    shadow-2xl shadow-black/50
                    transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                    ${isOpen ? "translate-x-0" : "translate-x-full"}`}
            >
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <span className="text-sm font-bold text-(--muted) uppercase tracking-widest font-mono">
                        Navigation
                    </span>
                    <button
                        onClick={onClose}
                        aria-label="Close navigation"
                        className="flex items-center justify-center w-9 h-9 rounded-lg text-(--muted) hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Drawer Body */}
                <div className="flex flex-col gap-1 p-4 flex-1 overflow-y-auto">
                    <p className="text-[10px] uppercase tracking-widest text-(--muted) font-mono px-3 mb-1">
                        App
                    </p>
                    <NavItem
                        to="/payroll"
                        icon={<Wallet className="w-4 h-4" />}
                        label="Payroll"
                        onClick={onClose}
                    />
                    <NavItem
                        to="/employee"
                        icon={<User className="w-4 h-4" />}
                        label="Employees"
                        onClick={onClose}
                    />
                    <NavItem
                        to="/reports"
                        icon={<FileText className="w-4 h-4" />}
                        label="Reports"
                        onClick={onClose}
                    />
                    <NavItem
                        to="/cross-asset-payment"
                        icon={<Globe className="w-4 h-4" />}
                        label="Cross-Asset"
                        onClick={onClose}
                    />
                    <NavItem
                        to="/transactions"
                        icon={<Activity className="w-4 h-4" />}
                        label="History"
                        onClick={onClose}
                    />

                    <div className="h-px bg-[var(--border)] my-3" />

                    <p className="text-[10px] uppercase tracking-widest text-(--muted) font-mono px-3 mb-1">
                        Developer
                    </p>
                    <NavItem
                        to="/debug"
                        icon={<Code className="w-4 h-4" />}
                        label="debugger"
                        isDebug
                        onClick={onClose}
                    />

                    <Link
                        to="/help"
                        onClick={onClose}
                        className="px-3 py-2.5 text-blue-500 text-xs hover:underline mt-2 inline-block"
                    >
                        Need help?
                    </Link>
                </div>

                {/* Drawer Footer: User + Wallet */}
                <div className="border-t border-[var(--border)] p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-[var(--border)]">
                        <Avatar
                            email={currentUser.email}
                            name={currentUser.name}
                            imageUrl={currentUser.imageUrl}
                            size="md"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-(--text) truncate leading-tight">
                                {currentUser.name}
                            </p>
                            <p className="text-xs text-(--muted) truncate leading-tight">
                                {currentUser.email}
                            </p>
                        </div>
                    </div>
                    <ConnectAccount />
                </div>
            </nav>
        </>
    );
};

// ── Public hook so AppLayout can control open state ─────────────────
export function useMobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    // Close on route change
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((v) => !v),
    };
}

// ── Default export: thin wrapper that wires everything ──────────────
const AppNav: React.FC = () => null; // kept for compatibility; layout now uses sub-exports


export { DesktopNav, MobileNav };
export default AppNav;

