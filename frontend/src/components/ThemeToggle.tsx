import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg border border-(--border-hi) bg-(--surface) hover:bg-(--surface-hi) active:scale-95 transition-all outline-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 flex items-center justify-center text-(--text) min-w-[44px] min-h-[44px]"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
    >
      {isDark ? (
        <Sun className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Moon className="w-4 h-4" aria-hidden="true" />
      )}
      <span className="sr-only">Current theme: {isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
};
