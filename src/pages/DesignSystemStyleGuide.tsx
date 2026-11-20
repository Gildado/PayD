// src/pages/DesignSystemStyleGuide.tsx
import React, { useState } from 'react';

export const DesignSystemStyleGuide: React.FC = () => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [activeTab, setActiveTab] = useState<'tokens' | 'buttons' | 'cards' | 'forms'>('tokens');

    return (
        <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}`}>
            {/* Top Navigation Bar */}
            <header className={`sticky top-0 z-50 border-b backdrop-blur-md px-6 py-4 flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-white/80'}`}>
                <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/30">
                        P
                    </div>
                    <div>
                        <h1 className="text-base font-semibold">PayD Design System</h1>
                        <span className="text-xs text-blue-500 font-mono">v2.4.0 — Mainnet Ready</span>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`rounded-xl px-3.5 py-2 text-xs font-medium border transition-colors cursor-pointer ${
                            isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                {/* Intro Banner */}
                <div className={`rounded-3xl p-8 mb-10 border ${isDarkMode ? 'bg-gradient-to-br from-blue-950/40 to-slate-900/60 border-blue-900/40' : 'bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-100'}`}>
                    <h2 className="text-2xl font-bold tracking-tight mb-3">myworkpay.com-Inspired Design Language</h2>
                    <p className={`text-sm max-w-3xl leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Engineered for high-trust payroll operations handling real funds on mainnet. Featuring deep blue primary palettes, vibrant teal/bright-blue accents, generous whitespace, solid rounded CTA buttons, and WCAG AAA accessibility compliance.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 mb-8 pb-2">
                    {[
                        { id: 'tokens', label: 'Color & Typography Tokens' },
                        { id: 'buttons', label: 'Buttons & CTAs' },
                        { id: 'cards', label: 'Cards & Containers' },
                        { id: 'forms', label: 'Form Controls' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                                activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                    : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Section Content */}
                {activeTab === 'tokens' && (
                    <div className="space-y-8 animate-fade-in">
                        <section>
                            <h3 className="text-lg font-semibold mb-4">Color Palette Tokens</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { name: 'Primary Deep Blue', hex: '#0F172A', bg: 'bg-slate-900 text-white' },
                                    { name: 'Action Blue', hex: '#2563EB', bg: 'bg-blue-600 text-white' },
                                    { name: 'Bright Teal Accent', hex: '#0EA5E9', bg: 'bg-sky-500 text-white' },
                                    { name: 'Success Emerald', hex: '#10B981', bg: 'bg-emerald-500 text-white' },
                                ].map((color, idx) => (
                                    <div key={idx} className={`rounded-2xl p-5 border ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'} shadow-sm`}>
                                        <div className={`h-12 w-full rounded-xl ${color.bg} flex items-center justify-center font-mono text-xs font-bold mb-3 shadow-inner`}>
                                            {color.hex}
                                        </div>
                                        <h4 className="text-sm font-semibold">{color.name}</h4>
                                        <span className="text-xs text-slate-500 font-mono">Mainnet Token</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'buttons' && (
                    <div className="space-y-8 animate-fade-in">
                        <section>
                            <h3 className="text-lg font-semibold mb-4">Buttons & Interactive CTAs</h3>
                            <div className={`rounded-2xl p-6 border ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'} flex flex-wrap gap-4 items-center`}>
                                <button className="rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-xs font-semibold text-white transition-all shadow-lg shadow-blue-600/25 cursor-pointer">
                                    Primary Action CTA
                                </button>
                                <button className="rounded-xl bg-sky-500 hover:bg-sky-400 px-6 py-3 text-xs font-semibold text-white transition-all shadow-lg shadow-sky-500/25 cursor-pointer">
                                    Teal Accent CTA
                                </button>
                                <button className={`rounded-xl px-6 py-3 text-xs font-semibold border transition-all cursor-pointer ${isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-200' : 'border-slate-300 hover:bg-slate-100 text-slate-700'}`}>
                                    Secondary Outline
                                </button>
                                <button className="text-blue-500 hover:text-blue-400 text-xs font-semibold flex items-center space-x-1 cursor-pointer">
                                    <span>View payroll history</span>
                                    <span>→</span>
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'cards' && (
                    <div className="space-y-8 animate-fade-in">
                        <section>
                            <h3 className="text-lg font-semibold mb-4">Containers & Cards</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className={`rounded-3xl p-6 border ${isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'} shadow-xl`}>
                                    <h4 className="text-base font-semibold mb-2">Standard Payroll Batch</h4>
                                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                                        Processed securely via multi-sig escrow with verified worker wallet addresses.
                                    </p>
                                    <div className="flex justify-between items-center text-xs font-mono pt-4 border-t border-slate-800">
                                        <span className="text-slate-500">Total Disbursement</span>
                                        <span className="text-emerald-400 font-bold">14,250.00 XLM</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'forms' && (
                    <div className="space-y-8 animate-fade-in">
                        <section>
                            <h3 className="text-lg font-semibold mb-4">Form Controls & Inputs</h3>
                            <div className={`max-w-md rounded-2xl p-6 border ${isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'} space-y-4 shadow-xl`}>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Payroll Recipient Address</label>
                                    <input
                                        type="text"
                                        placeholder="G... (Stellar Public Key)"
                                        className={`w-full rounded-xl p-3 text-xs font-mono border transition-colors focus:outline-none focus:border-blue-500 ${
                                            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                                        }`}
                                    />
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
};