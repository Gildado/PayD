import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { THEME_PREFERENCES, ThemePreference, useTheme } from '../hooks/useTheme';

const ICONS: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/**
 * Header theme picker: a menu button offering Light, Dark and System. System
 * follows the OS `prefers-color-scheme` live; the choice is persisted by
 * ThemeProvider.
 */
export const ThemeToggle = () => {
  const { t } = useTranslation();
  const { theme, preference, systemTheme, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const optionLabel = (option: ThemePreference) =>
    option === 'system'
      ? t('theme.systemResolved', { theme: t(`theme.${systemTheme}`) })
      : t(`theme.${option}`);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Moving focus into the menu when it opens puts keyboard users on the
  // current choice, as the menu button pattern expects.
  useEffect(() => {
    if (!open) return;
    const index = THEME_PREFERENCES.indexOf(preference);
    itemRefs.current[index >= 0 ? index : 0]?.focus();
  }, [open, preference]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, close]);

  const choose = (option: ThemePreference) => {
    setPreference(option);
    close(true);
  };

  const onButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (index: number) => items[(index + items.length) % items.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(current + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const CurrentIcon = ICONS[preference];
  const buttonLabel = t('theme.buttonLabel', { theme: optionLabel(preference) });

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        className="p-2 rounded-lg border border-(--border-hi) bg-(--surface) hover:bg-(--surface-hi) active:scale-95 transition-all outline-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 flex items-center justify-center text-(--text) min-w-[44px] min-h-[44px]"
        title={buttonLabel}
        aria-label={buttonLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        {/* keying by the choice remounts the icon so the entrance animation replays on every change */}
        <span
          key={`${preference}-${theme}`}
          className="motion-theme-icon flex items-center justify-center"
        >
          <CurrentIcon className="w-4 h-4" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('theme.menuLabel')}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] rounded-lg border border-(--border-hi) bg-(--surface) p-1 shadow-lg"
        >
          {THEME_PREFERENCES.map((option, index) => {
            const Icon = ICONS[option];
            const checked = option === preference;
            return (
              <button
                key={option}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => choose(option)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 hover:bg-(--surface-hi) ${
                  checked ? 'font-semibold text-(--accent)' : 'text-(--text)'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{optionLabel(option)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
