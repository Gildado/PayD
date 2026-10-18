import React from 'react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
export type IconTone =
  | 'accent'
  | 'accent2'
  | 'accent3'
  | 'muted'
  | 'text'
  | 'danger'
  | 'success'
  | 'on-accent';

export interface BaseIconProps extends React.SVGAttributes<SVGElement> {
  size?: IconSize;
  strokeWidth?: number;
  tone?: IconTone;
  className?: string;
  'aria-label'?: string;
  title?: string;
}

const sizeMap: Record<Exclude<IconSize, number>, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

const toneClassMap: Record<IconTone, string> = {
  accent: 'text-accent',
  accent2: 'text-accent2',
  accent3: 'text-accent3',
  muted: 'text-muted',
  text: 'text-text',
  danger: 'text-danger',
  success: 'text-success',
  'on-accent': 'text-on-accent',
};

// eslint-disable-next-line react-refresh/only-export-components
export function resolveIconSize(size: IconSize = 'md'): number {
  return typeof size === 'number' ? size : sizeMap[size] ?? 20;
}

interface SvgIconProps extends BaseIconProps {
  children: React.ReactNode;
}

export const SvgIcon: React.FC<SvgIconProps> = ({
  size = 'md',
  strokeWidth = 1.75,
  tone,
  className,
  'aria-label': ariaLabel,
  title,
  children,
  ...rest
}) => {
  const pixelSize = resolveIconSize(size);
  const classes = [
    'inline-block shrink-0 align-middle transition-colors',
    tone ? toneClassMap[tone] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const a11yProps = ariaLabel
    ? { role: 'img', 'aria-label': ariaLabel }
    : { 'aria-hidden': 'true' as const };

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={classes}
      {...a11yProps}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
};

// ── Standard Icon Components ─────────────────────────────────────────────

export const ArrowRightIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </SvgIcon>
);

export const ArrowLeftIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </SvgIcon>
);

export const ChevronRightIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <polyline points="9 18 15 12 9 6" />
  </SvgIcon>
);

export const ChevronLeftIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <polyline points="15 18 9 12 15 6" />
  </SvgIcon>
);

export const ChevronDownIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <polyline points="6 9 12 15 18 9" />
  </SvgIcon>
);

export const ChevronUpIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <polyline points="18 15 12 9 6 15" />
  </SvgIcon>
);

export const CheckIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <polyline points="20 6 9 17 4 12" />
  </SvgIcon>
);

export const CheckCircleIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </SvgIcon>
);

export const XIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </SvgIcon>
);

export const RocketIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </SvgIcon>
);

export const CreditCardIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </SvgIcon>
);

export const UsersIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </SvgIcon>
);

export const ShieldTickIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </SvgIcon>
);

export const ShieldIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </SvgIcon>
);

export const StarIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </SvgIcon>
);

export const QuoteIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <path d="M3 21c3 0 7-1 7-8V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2 0 4-1 6-2 8" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2 0 4-1 6-2 8" />
  </SvgIcon>
);

export const CookieIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
    <path d="M8.5 8.5v.01" />
    <path d="M16 15.5v.01" />
    <path d="M12 12v.01" />
    <path d="M11 17v.01" />
    <path d="M7 13v.01" />
  </SvgIcon>
);

export const PauseIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </SvgIcon>
);

export const PlayIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </SvgIcon>
);

export const ExternalLinkIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </SvgIcon>
);

export const BuildingIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M12 6h.01" />
    <path d="M12 10h.01" />
    <path d="M12 14h.01" />
    <path d="M16 10h.01" />
    <path d="M16 14h.01" />
    <path d="M8 10h.01" />
    <path d="M8 14h.01" />
  </SvgIcon>
);

export const LockIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </SvgIcon>
);

export const GlobeIcon: React.FC<BaseIconProps> = (props) => (
  <SvgIcon {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </SvgIcon>
);

// ── Standard Icon Registry Namespace ──────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export const StandardIcon = {
  ArrowRight: ArrowRightIcon,
  ArrowLeft: ArrowLeftIcon,
  ChevronRight: ChevronRightIcon,
  ChevronLeft: ChevronLeftIcon,
  ChevronDown: ChevronDownIcon,
  ChevronUp: ChevronUpIcon,
  Check: CheckIcon,
  CheckCircle: CheckCircleIcon,
  X: XIcon,
  Rocket: RocketIcon,
  CreditCard: CreditCardIcon,
  Users: UsersIcon,
  ShieldTick: ShieldTickIcon,
  Shield: ShieldIcon,
  Star: StarIcon,
  Quote: QuoteIcon,
  Cookie: CookieIcon,
  Pause: PauseIcon,
  Play: PlayIcon,
  ExternalLink: ExternalLinkIcon,
  Building: BuildingIcon,
  Lock: LockIcon,
  Globe: GlobeIcon,
};

export default StandardIcon;
