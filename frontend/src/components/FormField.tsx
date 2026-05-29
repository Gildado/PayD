import React, { useId } from 'react';

export interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required = false,
  error,
  helpText,
  children,
  className = '',
}) => {
  const hasError = !!error;
  const generatedId = useId();
  const descriptionId = `${id}-description-${generatedId}`;
  const errorId = `${id}-error-${generatedId}`;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-[var(--text)]">
        {label}
        {required && (
          <span className="text-[var(--danger)] ml-1" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </label>

      <div className="relative">
        {React.isValidElement(children)
          ? React.cloneElement(children, {
              id,
              required,
              'aria-required': required,
              'aria-invalid': hasError || undefined,
              'aria-describedby': error ? errorId : helpText ? descriptionId : undefined,
              className: [
                typeof (children.props as Record<string, unknown>).className === 'string'
                  ? (children.props as Record<string, unknown>).className
                  : '',
                hasError
                  ? '!border-[var(--danger)] focus:!border-[var(--danger)] focus:!ring-[var(--danger)]/20'
                  : '',
              ]
                .filter(Boolean)
                .join(' '),
            } as React.HTMLAttributes<HTMLElement>)
          : children}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="text-xs text-[var(--danger)] font-medium"
        >
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
