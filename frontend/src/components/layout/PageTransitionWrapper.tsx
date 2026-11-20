// src/components/layout/PageTransitionWrapper.tsx
import React from 'react';

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  isDarkMode?: boolean;
}

export const PageTransitionWrapper: React.FC<PageTransitionWrapperProps> = ({
  children,
  isDarkMode,
}) => {
  return (
    <div
      data-theme={isDarkMode !== undefined ? (isDarkMode ? 'dark' : 'light') : undefined}
      className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300 ease-out animate-fade-in"
    >
      <div className="mx-auto max-w-7xl px-6 py-10">
        {children}
      </div>
    </div>
  );
};