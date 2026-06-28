import React, { useCallback, useState, useRef, useId } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from 'lucide-react';

export interface PaginationControlsProps {
  /**
   * Current page number (1-indexed)
   */
  currentPage: number;
  /**
   * Total number of pages
   */
  totalPages: number;
  /**
   * Callback when page changes
   */
  onPageChange: (page: number) => void;
  /**
   * Number of visible page buttons (excluding prev/next)
   */
  maxVisiblePages?: number;
  /**
   * Show first/last page buttons
   */
  showFirstLast?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Disable pagination
   */
  disabled?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
  showFirstLast = true,
  className = '',
  disabled = false,
}) => {
  const [showPageJump, setShowPageJump] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState('');
  const pageJumpInputRef = useRef<HTMLInputElement>(null);
  const pageJumpButtonRef = useRef<HTMLButtonElement>(null);
  const announcementId = useId();

  const getPageRange = useCallback(() => {
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = start + maxVisiblePages - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    return { start, end };
  }, [currentPage, maxVisiblePages, totalPages]);

  const { start, end } = getPageRange();
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages && !disabled) {
        onPageChange(page);
      }
    },
    [onPageChange, totalPages, disabled]
  );

  const handleEllipsisClick = useCallback(() => {
    setShowPageJump(true);
    setPageJumpInput('');
    setTimeout(() => pageJumpInputRef.current?.focus(), 0);
  }, []);

  const handlePageJumpSubmit = useCallback(() => {
    const page = parseInt(pageJumpInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      handlePageChange(page);
      setShowPageJump(false);
      pageJumpButtonRef.current?.focus();
    }
  }, [pageJumpInput, totalPages, handlePageChange]);

  const handlePageJumpKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handlePageJumpSubmit();
      } else if (e.key === 'Escape') {
        setShowPageJump(false);
        pageJumpButtonRef.current?.focus();
      }
    },
    [handlePageJumpSubmit]
  );

  if (totalPages <= 1) {
    return null;
  }

  const buttonClass = (isActive: boolean) =>
    `px-3 py-2 rounded-lg border transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 ${
      isActive
        ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]'
        : 'border-[var(--border-hi)] text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-50 disabled:cursor-not-allowed'
    }`;

  const iconButtonClass = `p-2 rounded-lg border border-[var(--border-hi)] text-[var(--text)] hover:bg-[var(--surface)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <>
      <div id={announcementId} className="sr-only" aria-live="polite" aria-atomic="true">
        Page {currentPage} of {totalPages}
      </div>
      <nav
        className={`flex items-center justify-center gap-2 ${className}`}
        aria-label="Pagination"
      >
        {showFirstLast && (
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || disabled}
            className={iconButtonClass}
            title="Go to first page"
            aria-label="Go to first page"
            type="button"
          >
            <ChevronsLeft size={18} />
          </button>
        )}

        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || disabled}
          className={iconButtonClass}
          title="Go to previous page"
          aria-label="Go to previous page"
          type="button"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex gap-1 flex-wrap justify-center items-center">
          {start > 1 && (
            <>
              <button
                onClick={() => handlePageChange(1)}
                className={buttonClass(false)}
                type="button"
                disabled={disabled}
              >
                1
              </button>
              {start > 2 && (
                <div className="relative">
                  <button
                    ref={pageJumpButtonRef}
                    onClick={handleEllipsisClick}
                    className="px-3 py-2 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                    title={`Jump to pages ${start - 1} through 2`}
                    aria-label={`Jump to pages between 1 and ${start}`}
                    aria-expanded={showPageJump}
                    aria-haspopup="dialog"
                    type="button"
                    disabled={disabled}
                  >
                    …
                  </button>
                  {showPageJump && (
                    <div className="absolute top-full mt-2 z-10 bg-[var(--surface)] border border-[var(--border-hi)] rounded-lg shadow-lg p-3 min-w-max">
                      <div className="flex items-center gap-2 mb-2">
                        <label
                          htmlFor="page-jump-input"
                          className="text-xs font-medium text-[var(--text)]"
                        >
                          Go to page:
                        </label>
                        <button
                          onClick={() => setShowPageJump(false)}
                          className="ml-auto p-1 text-[var(--muted)] hover:text-[var(--text)]"
                          aria-label="Close"
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={pageJumpInputRef}
                          id="page-jump-input"
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageJumpInput}
                          onChange={(e) => setPageJumpInput(e.target.value)}
                          onKeyDown={handlePageJumpKeyDown}
                          placeholder={`1-${totalPages}`}
                          className="w-16 px-2 py-1 text-sm border border-[var(--border-hi)] rounded text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                        />
                        <button
                          onClick={handlePageJumpSubmit}
                          className="px-2 py-1 text-xs font-medium bg-[var(--accent)] text-[var(--bg)] rounded hover:bg-[var(--accent)]/90 transition-colors"
                          type="button"
                        >
                          Go
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {pages.map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={buttonClass(page === currentPage)}
              aria-label={`Go to page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
              type="button"
              disabled={disabled}
            >
              {page}
            </button>
          ))}

          {end < totalPages && (
            <>
              {end < totalPages - 1 && (
                <div className="relative">
                  <button
                    onClick={handleEllipsisClick}
                    className="px-3 py-2 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                    title={`Jump to pages ${end + 2} through ${totalPages - 1}`}
                    aria-label={`Jump to pages between ${end} and ${totalPages}`}
                    aria-expanded={showPageJump}
                    aria-haspopup="dialog"
                    type="button"
                    disabled={disabled}
                  >
                    …
                  </button>
                  {showPageJump && (
                    <div className="absolute top-full mt-2 z-10 bg-[var(--surface)] border border-[var(--border-hi)] rounded-lg shadow-lg p-3 min-w-max">
                      <div className="flex items-center gap-2 mb-2">
                        <label
                          htmlFor="page-jump-input"
                          className="text-xs font-medium text-[var(--text)]"
                        >
                          Go to page:
                        </label>
                        <button
                          onClick={() => setShowPageJump(false)}
                          className="ml-auto p-1 text-[var(--muted)] hover:text-[var(--text)]"
                          aria-label="Close"
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={pageJumpInputRef}
                          id="page-jump-input"
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageJumpInput}
                          onChange={(e) => setPageJumpInput(e.target.value)}
                          onKeyDown={handlePageJumpKeyDown}
                          placeholder={`1-${totalPages}`}
                          className="w-16 px-2 py-1 text-sm border border-[var(--border-hi)] rounded text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                        />
                        <button
                          onClick={handlePageJumpSubmit}
                          className="px-2 py-1 text-xs font-medium bg-[var(--accent)] text-[var(--bg)] rounded hover:bg-[var(--accent)]/90 transition-colors"
                          type="button"
                        >
                          Go
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => handlePageChange(totalPages)}
                className={buttonClass(false)}
                type="button"
                disabled={disabled}
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || disabled}
          className={iconButtonClass}
          title="Go to next page"
          aria-label="Go to next page"
          type="button"
        >
          <ChevronRight size={18} />
        </button>

        {showFirstLast && (
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages || disabled}
            className={iconButtonClass}
            title="Go to last page"
            aria-label="Go to last page"
            type="button"
          >
            <ChevronsRight size={18} />
          </button>
        )}

        <span className="ml-4 text-sm text-[var(--muted)]">
          Page <span className="font-semibold text-[var(--text)]">{currentPage}</span> of{' '}
          <span className="font-semibold text-[var(--text)]">{totalPages}</span>
        </span>
      </nav>
    </>
  );
};
