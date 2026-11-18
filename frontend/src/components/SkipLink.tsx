import React from 'react';
import { useTranslation } from 'react-i18next';

/** Id of the layout's single `<main>` landmark; the skip link targets it. */
export const MAIN_CONTENT_ID = 'main-content';

interface SkipLinkProps {
  targetId?: string;
}

/**
 * "Skip to main content" link (WCAG 2.4.1 Bypass Blocks). Visually hidden
 * until it receives keyboard focus; it must be the first focusable element of
 * a layout. The target needs `tabIndex={-1}` so it can take focus.
 *
 * Focus is moved explicitly instead of relying on the `#hash` jump, which the
 * router would otherwise treat as navigation and which does not move focus in
 * every browser.
 */
export const SkipLink: React.FC<SkipLinkProps> = ({ targetId = MAIN_CONTENT_ID }) => {
  const { t } = useTranslation();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    target.focus();
    target.scrollIntoView?.({ block: 'start' });
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-on-accent focus:rounded-lg focus:font-medium"
    >
      {t('common.skipToContent')}
    </a>
  );
};
