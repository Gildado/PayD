import React, { useId } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

export interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  helpText?: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Show success indicator
   */
  isValid?: boolean;
  /**
   * Max character count (for showing character counter)
   */
  maxLength?: number;
  /**
   * Current character count (for showing character counter)
   */
  currentLength?: number;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required = false,
  optional = false,
  error,
  helpText,
  children,
  className = '',
  isValid = false,
  maxLength,
  currentLength,
}) => {
  const hasError = !!error;
  const generatedId = useId();
  const descriptionId = `${id}-description-${generatedId}`;
  const errorId = `${id}-error-${generatedId}`;
  const charactersId = `${id}-chars-${generatedId}`;

  const showCharCount = maxLength !== undefined && currentLength !== undefined;
  const charCountPercent = showCharCount ? (currentLength / maxLength) * 100 : 0;
  const charCountWarning = showCharCount && currentLength > maxLength * 0.8;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-[var(--text)]">
          {label}
          {required && (
            <span className="text-[var(--danger)] ml-1" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only">(required)</span>}
          {optional && !required && (
            <span className="text-[var(--muted)] ml-1 text-xs font-normal">(optional)</span>
          )}
        </label>

        {isValid && !hasError && (
          <span className="text-green-400" role="status" aria-label="Valid">
            <CheckCircle size={16} />
          </span>
        )}
      </div>

      <div className="relative">
        {React.isValidElement(children)
          ? // eslint-disable-next-line react-x/no-clone-element
            React.cloneElement(children, {
              id,
              required,
              'aria-required': required,
              'aria-invalid': hasError || undefined,
              'aria-describedby':
                [
                  error ? errorId : undefined,
                  helpText && !error ? descriptionId : undefined,
                  showCharCount ? charactersId : undefined,
                ]
                  .filter(Boolean)
                  .join(' ') || undefined,
              maxLength: maxLength || undefined,
              className: [
                typeof (children.props as Record<string, unknown>).className === 'string'
                  ? (children.props as Record<string, unknown>).className
                  : '',
                hasError
                  ? '!border-[var(--danger)] focus:!border-[var(--danger)] focus:!ring-[var(--danger)]/20'
                  : isValid
                    ? '!border-green-500/50 focus:!border-green-500 focus:!ring-green-500/20'
                    : '',
              ]
                .filter(Boolean)
                .join(' '),
            } as React.HTMLAttributes<HTMLElement>)
          : children}

        {hasError && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--danger)]">
            <AlertCircle size={18} />
          </span>
        )}
      </div>

      {showCharCount && (
        <div className="space-y-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface)]">
            <div
              className={`h-full transition-all ${
                charCountWarning ? 'bg-amber-500' : 'bg-[var(--accent)]'
              }`}
              style={{ width: `${Math.min(charCountPercent, 100)}%` }}
            />
          </div>
          <p
            id={charactersId}
            className={`text-xs font-medium ${
              charCountWarning ? 'text-amber-400' : 'text-[var(--muted)]'
            }`}
          >
            {currentLength} / {maxLength} characters
          </p>
        </div>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="text-xs text-[var(--danger)] font-medium flex items-center gap-1"
        >
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      {helpText && !error && (
        <p id={descriptionId} className="text-xs text-[var(--muted)]">
          {helpText}
        </p>
      )}
    </div>
  );
};

FormField.displayName = 'FormField';
