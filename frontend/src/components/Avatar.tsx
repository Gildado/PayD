import React from 'react';
import { MD5 } from 'crypto-js';

interface AvatarProps {
  email: string;
  name?: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  email,
  name = 'User',
  imageUrl,
  size = 'md',
  className = '',
}) => {
  const [hasImageError, setHasImageError] = React.useState(false);

  React.useEffect(() => {
    setHasImageError(false);
  }, [imageUrl, email]);

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  const getGravatarUrl = (email: string) => {
    const hash = MD5(email.toLowerCase().trim()).toString();
    return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=400`;
  };

  const avatarUrl = imageUrl || getGravatarUrl(email || name);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className={`${sizeClasses[size]} ${className} rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-2 ring-offset-1`}
      style={{
        backgroundColor: 'var(--surface-hi)',
        ringColor: 'var(--border)',
        ringOffsetColor: 'var(--bg)',
        transition: prefersReducedMotion
          ? 'none'
          : `all var(--motion-duration-fast) var(--motion-ease-out)`,
      }}
      title={name}
      role="img"
      aria-label={name}
      onMouseEnter={(e) => {
        if (!prefersReducedMotion) {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 4px var(--accent)/20`;
        }
      }}
      onMouseLeave={(e) => {
        if (!prefersReducedMotion) {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }
      }}
    >
      {!hasImageError ? (
        <img
          src={avatarUrl}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover"
          style={{
            transition: prefersReducedMotion
              ? 'none'
              : `opacity var(--motion-duration-normal) var(--motion-ease-out)`,
            opacity: 1,
          }}
          onError={() => {
            setHasImageError(true);
          }}
        />
      ) : (
        <span
          className="w-full h-full text-white font-semibold flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, var(--accent), hsl(${Math.abs(
              name.charCodeAt(0) * 12
            )} 70% 50%))`,
            transition: prefersReducedMotion
              ? 'none'
              : `all var(--motion-duration-normal) var(--motion-ease-out)`,
          }}
        >
          {initials || '?'}
        </span>
      )}
    </div>
  );
};
