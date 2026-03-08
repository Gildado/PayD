import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const EmployerDashboardLayout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    return (
        <div
            className="flex h-screen overflow-hidden flex-col lg:flex-row"
            style={{ background: 'var(--bg)', color: 'var(--text)' }}
        >
            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden bg-(--bg)">
                <TopBar onMenuToggle={() => setSidebarOpen(true)} />

                <main className="flex-1 overflow-y-auto px-6 py-10 relative scroll-smooth overflow-x-hidden md:px-12">
                    {/* Outlet for nested routes */}
                    <div key={location.pathname} className="mx-auto w-full max-w-7xl relative z-20">
                        <Outlet />
                    </div>

                    {/* Optional background glow decor */}
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-(--accent)/5 blur-[120px] rounded-full pointer-events-none z-10 animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-(--accent2)/5 blur-[120px] rounded-full pointer-events-none z-10 animate-pulse" />
                </main>

                {/* Footer info (optional for dashboard) */}
                <footer className="px-12 py-4 border-t border-(--border-hi) text-[10px] font-mono text-(--muted) flex justify-between items-center bg-(--surface)/30">
                    <span>© {new Date().getFullYear()} PayD · Dashboard Layer v1.0</span>
                    <div className="flex items-center gap-1.5 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition duration-300 cursor-default">
                        STELLAR NETWORK · MAINNET
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default EmployerDashboardLayout;
