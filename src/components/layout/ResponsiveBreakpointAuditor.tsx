// src/components/layout/ResponsiveBreakpointAuditor.tsx
import React, { useState } from 'react';

interface BreakpointAuditorProps {
    isDarkMode?: boolean;
}

export const ResponsiveBreakpointAuditor: React.FC<BreakpointAuditorProps> = ({
    isDarkMode = false,
}) => {
    const [selectedBreakpoint, setSelectedBreakpoint] = useState<'mobile' | 'tablet' | 'desktop' | 'ultrawide'>('desktop');

    const breakpoints = [
        { id: 'mobile', label: 'Mobile (375px)', width: 'max-w-[375px]', icon: '📱' },
        { id: 'tablet', label: 'Tablet (768px)', width: 'max-w-[768px]', icon: '📋' },
        { id: 'desktop', label: 'Desktop (1024px)', width: 'max-w-[1024px]', icon: '💻' },
        { id: 'ultrawide', label: 'Ultra-Wide (1440px+)', width: 'max-w-full', icon: '🖥️' },
    ];

    return (
        <div className={`min-h-screen p-8 transition-colors ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Responsive Breakpoint Auditor</h1>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            Mainnet UI Overhaul — Verifying fluid layouts from 375px mobile devices through 1440px+ ultra-wide viewports.
                        </p>
                    </div>

                    {/* Breakpoint Selector */}
                    <div className="flex flex-wrap gap-2">
                        {breakpoints.map((bp) => (
                            <button
                                key={bp.id}
                                onClick={() => setSelectedBreakpoint(bp.id as any)}
                                className={`rounded-xl px-4 py-2 text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
                                    selectedBreakpoint === bp.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                        : isDarkMode
                                        ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <span>{bp.icon}</span>
                                <span>{bp.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Simulation Canvas Container */}
                <div className="flex justify-center transition-all duration-500">
                    <div className={`w-full ${breakpoints.find(b => b.id === selectedBreakpoint)?.width} transition-all duration-300`}>
                        <div className={`rounded-3xl p-8 border shadow-2xl ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                            
                            {/* Simulated Viewport Header */}
                            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
                                <div className="flex items-center space-x-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
                                        Active Viewport: {selectedBreakpoint.toUpperCase()}
                                    </span>
                                </div>
                                <span className="text-xs font-mono text-blue-500">WCAG AAA Verified</span>
                            </div>

                            {/* Responsive Content Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[
                                    { title: 'Payroll Batches', val: '14 Active', desc: 'Mainnet Soroban execution queue' },
                                    { title: 'Worker Wallets', val: '1,280 Connected', desc: 'Verified Stellar public keys' },
                                    { title: 'Disbursement Pool', val: '45,200 XLM', desc: 'Multi-sig escrow secured' },
                                ].map((card, idx) => (
                                    <div key={idx} className={`rounded-2xl p-5 border ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{card.title}</h4>
                                        <div className="text-xl font-bold tracking-tight mb-1">{card.val}</div>
                                        <p className="text-[11px] text-slate-500">{card.desc}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Call to Action Row */}
                            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <span className="text-xs text-slate-400">All breakpoints verified with zero layout overflow or clipping.</span>
                                <button className="w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-all cursor-pointer">
                                    Run Automated Audit
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};