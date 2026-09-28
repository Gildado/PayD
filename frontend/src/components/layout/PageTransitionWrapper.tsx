// src/components/layout/PageTransitionWrapper.tsx
import React from 'react';

interface PageTransitionWrapperProps {
    children: React.ReactNode;
    isDarkMode?: boolean;
}

export const PageTransitionWrapper: React.FC<PageTransitionWrapperProps> = ({
    children,
    isDarkMode = false,
}) => {
    return (
        <div
            className={`transition-all duration-300 ease-out animate-fade-in min-h-screen ${
                isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
            }`}
        >
            <div className="mx-auto max-w-7xl px-6 py-10">
                {children}
            </div>
        </div>
    );
};