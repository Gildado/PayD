import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { ArrowRightIcon } from './Icon';

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

interface ArrowActionProps {
  children: React.ReactNode;
  className?: string;
}

const arrowActionClassName = (className?: string) =>
  ['link-arrow', className ?? ''].filter(Boolean).join(' ');

const ArrowActionContent: React.FC<ArrowActionProps> = ({ children, className }) => (
  <>
    {children}
    <ArrowRightIcon className={className} size="sm" aria-hidden="true" />
  </>
);

/** Secondary router link with a trailing arrow that nudges on hover. */
export const ArrowLink: React.FC<ArrowLinkProps> = ({ className, children, ...rest }) => (
  <Link className={arrowActionClassName(className)} {...rest}>
    <ArrowActionContent className="link-arrow-icon">{children}</ArrowActionContent>
  </Link>
);

export interface ArrowAnchorProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    ArrowActionProps {}

/** Secondary anchor link with a trailing arrow that nudges on hover. */
export const ArrowAnchor: React.FC<ArrowAnchorProps> = ({ className, children, ...rest }) => (
  <a className={arrowActionClassName(className)} {...rest}>
    <ArrowActionContent className="link-arrow-icon">{children}</ArrowActionContent>
  </a>
);

export interface ArrowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ArrowActionProps {}

/** Secondary callback action with the same visual treatment as an arrow link. */
export const ArrowButton: React.FC<ArrowButtonProps> = ({
  className,
  children,
  type = 'button',
  ...rest
}) => (
  <button type={type} className={arrowActionClassName(className)} {...rest}>
    <ArrowActionContent className="link-arrow-icon">{children}</ArrowActionContent>
  </button>
);
