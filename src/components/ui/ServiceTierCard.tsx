// src/components/ui/ServiceTierCard.tsx
import React from 'react';

interface ServiceTierCardProps {
    title: string;
    description: string;
    price: string;
    billingPeriod: string;
    features: string[];
    isPopular?: boolean;
    isDarkMode?: boolean;
    onSelect: () => void;
}

export const ServiceTierCard: React.FC<ServiceTierCardProps> = ({
    title,
    description,
    price,
    billingPeriod,
    features,
    isPopular = false,
    isDarkMode = false,
    onSelect,
}) => {
    return (
        <div
            className={`relative rounded-3xl p-8 border transition-all duration-300 flex flex-col justify-between ${
                isPopular
                    ? 'border-blue-500 shadow-2xl shadow-blue-500/15'
                    : isDarkMode
                    ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-xl shadow-slate-200/50'
            }`}
        >
            {isPopular && (
                <div className="absolute -top-3.5 left-8 rounded-full bg-blue-600 px-4 py-1 text-[11px] font-semibold text-white tracking-wide uppercase shadow-md shadow-blue-600/30">
                    Mainnet Recommended
                </div>
            )}

            <div>
                <h3 className={`text-lg font-bold tracking-tight mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {title}
                </h3>
                <p className={`text-xs leading-relaxed mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {description}
                </p>

                <div className="flex items-baseline space-x-1.5 mb-8">
                    <span className={`text-3xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {price}
                    </span>
                    <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        / {billingPeriod}
                    </span>
                </div>

                <div className="space-y-3.5 mb-8">
                    <span className={`text-[11px] font-semibold tracking-wider uppercase block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        What's Included
                    </span>
                    {features.map((feature, idx) => (
                        <div key={idx} className="flex items-center space-x-3 text-xs">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">
                                ✓
                            </div>
                            <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{feature}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <button
                    onClick={onSelect}
                    className={`w-full rounded-xl py-3.5 text-xs font-semibold transition-all shadow-lg cursor-pointer ${
                        isPopular
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
                            : isDarkMode
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                    }`}
                >
                    Select Tier
                </button>
            </div>
        </div>
    );
};