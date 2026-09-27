import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md' | 'lg';

function buttonClassName(variant: ButtonVariant, size: ButtonSize, className?: string): string {
  return ['btn', `btn-${variant}`, size !== 'md' ? `btn-${size}` : '', className ?? '']
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Solid, fully rounded call-to-action button. */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...rest
}) => <button type={type} className={buttonClassName(variant, size, className)} {...rest} />;

export interface ArrowLinkProps extends LinkProps {
  children: React.ReactNode;
}

/** Secondary text link with a trailing arrow that nudges on hover. */
export const ArrowLink: React.FC<ArrowLinkProps> = ({ className, children, ...rest }) => (
  <Link className={['link-arrow', className ?? ''].filter(Boolean).join(' ')} {...rest}>
    {children}
    <ArrowRight className="link-arrow-icon" size={16} aria-hidden="true" />
  </Link>
);
