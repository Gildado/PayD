import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import ConnectAccount from "../components/ConnectAccount";
import AppNav from "./AppNav";



// ── Page Wrapper ───────────────────────
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex flex-col flex-1">{children}</div>
);


// ── Layout ────────────────────────────
const AppLayout: React.FC = () => {
    const location = useLocation();

    return (
        <div className="flex flex-col min-h-screen bg-[#080b10] text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 h-[var(--header-h)] flex items-center px-16 flex justify-between bg-[#080b10]/85 backdrop-blur-[20px] backdrop-saturate-180 border-b border-white/10">
                {/* Logo */}
                <NavLink className="flex items-center gap-2.5" to="/">
                    <div className="w-8 h-8 rounded-lg grid place-items-center font-extrabold text-black text-sm tracking-tight shadow-[0_0_20px_rgba(74,240,184,0.3)] bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)]">
                        P
                    </div>
                    <span className="text-lg font-extrabold tracking-tight">
                        Pay<span className="text-[var(--accent)]">D</span>
                    </span>
                    <span className="text-[9px] font-normal font-mono text-[var(--muted)] tracking-widest uppercase border border-[var(--border-hi)] px-1.5 py-0.5 rounded ml-0.5">
                        BETA
                    </span>
                </NavLink>

                {/* Nav */}
                <div className="flex items-center gap-6 ml-auto">
                    <AppNav />
                    <div className="ml-4 flex items-center gap-3">
                        <ConnectAccount />
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="flex flex-col flex-1 pt-[var(--header-h)]">
                <PageWrapper>
                    <div key={location.pathname} className="flex flex-col flex-1 px-6 py-8">
                        <Outlet />
                    </div>
                </PageWrapper>
            </main>

            {/* Footer */}
            <footer className="flex flex-wrap justify-between items-center gap-2 px-6 py-5 border-t border-white/10 text-xs font-mono text-[var(--muted)]">
                <span>
                    © {new Date().getFullYear()} PayD — Licensed under the{" "}
                    <a
                        href="http://www.apache.org/licenses/LICENSE-2.0"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent)] hover:underline"
                    >
                        Apache License 2.0
                    </a>
                </span>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]" />
                    STELLAR NETWORK · MAINNET
                </div>
            </footer>
        </div>
    );
};

export default AppLayout;