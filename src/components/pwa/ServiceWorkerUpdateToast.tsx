// src/components/pwa/ServiceWorkerUpdateToast.tsx
import React, { useState, useEffect } from 'react';

interface ServiceWorkerUpdateToastProps {
    isDarkMode?: boolean;
    onRefresh?: () => void;
}

export const ServiceWorkerUpdateToast: React.FC<ServiceWorkerUpdateToastProps> = ({
    isDarkMode = false,
    onRefresh,
}) => {
    const [updateAvailable, setUpdateAvailable] = useState<boolean>(true); // Initialized true for demonstration

    if (!updateAvailable) return null;

    const handleReload = () => {
        if (onRefresh) {
            onRefresh();
        } else {
            window.location.reload();
        }
    };

    return (
        <aside
            aria-label="App Update Notice"
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-slide-up px-4"
        >
            <div
                className={`rounded-3xl p-5 border shadow-2xl backdrop-blur-xl transition-all ${
                    isDarkMode
                        ? 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-blue-950/20'
                        : 'bg-white/95 border-slate-200 text-slate-900 shadow-blue-900/10'
                }`}
            >
                <div className="flex items-start space-x-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/30">
                        ⚡
                    </div>
                    <div className="flex-1 pt-0.5">
                        <h4 className="text-sm font-semibold tracking-tight">Mainnet Update Available</h4>
                        <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            A new version of PayD payroll is ready with enhanced security updates. Refresh to load the latest release.
                        </p>
                        <div className="mt-4 flex items-center space-x-3">
                            <button
                                onClick={handleReload}
                                className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white transition-all shadow-md shadow-blue-600/25 cursor-pointer"
                            >
                                Refresh Now
                            </button>
                            <button
                                onClick={() => setUpdateAvailable(false)}
                                className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold border transition-all cursor-pointer ${
                                    isDarkMode
                                        ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                                        : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                                }`}
                            >
                                Later
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};