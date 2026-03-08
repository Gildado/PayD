import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Wallet,
    User,
    FileText,
    PieChart,
    Settings,
    HelpCircle,
    Menu,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();

    const navItems = [
        {
            to: '/',
            label: t('nav.dashboard', 'Dashboard'),
            icon: <LayoutDashboard size={20} />,
        },
        {
            to: '/payroll',
            label: t('nav.payroll', 'Payroll'),
            icon: <Wallet size={20} />,
        },
        {
            to: '/employee',
            label: t('nav.employees', 'Employees'),
            icon: <User size={20} />,
        },
        {
            to: '/reports',
            label: t('nav.reports', 'Reports'),
            icon: <FileText size={20} />,
        },
        {
            to: '/revenue-split',
            label: t('nav.revenueSplit', 'Revenue Split'),
            icon: <PieChart size={20} />,
        },
        {
            to: '/settings',
            label: t('nav.settings', 'Settings'),
            icon: <Settings size={20} />,
        },
    ];

    const bottomItems = [
        {
            to: '/help',
            label: t('nav.help', 'Help Center'),
            icon: <HelpCircle size={20} />,
        },
    ];

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`fixed lg:static top-0 left-0 z-50 h-full w-64 glass border-r border-(--border-hi) flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    }`}
                style={{ background: 'var(--surface)' }}
            >
                {/* Sidebar Header / Logo */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-(--border-hi)">
                    <NavLink className="flex items-center gap-2.5" to="/" onClick={onClose}>
                        <div className="w-8 h-8 rounded-lg grid place-items-center font-extrabold text-black text-sm tracking-tight shadow-[0_0_20px_rgba(74,240,184,0.3)] bg-linear-to-br from-(--accent) to-(--accent2)">
                            P
                        </div>
                        <span className="text-lg font-extrabold tracking-tight">
                            Pay<span className="text-(--accent)">D</span>
                        </span>
                    </NavLink>
                    <button className="lg:hidden p-1 text-(--muted) hover:text-(--text)" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Sidebar Nav */}
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${isActive
                                    ? 'text-(--accent) bg-(--accent)/5 border border-(--accent)/10'
                                    : 'text-(--muted) hover:bg-(--surface-hi) hover:text-(--text)'
                                }`
                            }
                        >
                            <span className="opacity-70">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Sidebar Bottom */}
                <div className="px-4 py-6 border-t border-(--border-hi) space-y-2">
                    {bottomItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition ${isActive
                                    ? 'text-(--text) bg-(--surface-hi)'
                                    : 'text-(--muted) hover:bg-(--surface-hi) hover:text-(--text)'
                                }`
                            }
                        >
                            <span className="opacity-70">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
