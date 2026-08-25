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
      className={`${sizeClasses[size]} ${className} rounded-full overflow-hidden flex items-center justify-center shrink-0 border`}
      style={{
        background: 'var(--surface-hi)',
        borderColor: 'var(--border)',
      }}
      title={name}
      role="img"
      aria-label={name}
      onMouseEnter={(e) => {
        if (!prefersReducedMotion) {
          (e.currentTarget as HTMLDivElement).classList.add('hover-scale-avatar');
        }
      }}
      onMouseLeave={(e) => {
        if (!prefersReducedMotion) {
          (e.currentTarget as HTMLDivElement).classList.remove('hover-scale-avatar');
        }
      }}
    >
      {!hasImageError ? (
        <img
          src={avatarUrl}
          alt={name}
          loading="lazy"
          className={`w-full h-full object-cover ${
            prefersReducedMotion
              ? ''
              : 'transition-opacity duration-(--motion-duration-normal) ease-(--motion-ease-out)'
          }`}
          onError={() => {
            setHasImageError(true);
          }}
        />
      ) : (
        <span
          className={`w-full h-full text-white font-semibold flex items-center justify-center ${
            prefersReducedMotion
              ? ''
              : 'transition-all duration-(--motion-duration-normal) ease-(--motion-ease-out)'
          }`}
          style={{
            background: `linear-gradient(135deg, var(--accent), var(--accent2))`,
          }}
        >
          {initials || '?'}
        </span>
      )}
    </div>
  );
};

// Add a tiny runtime style rule for the hover scale effect so it uses motion tokens
if (typeof document !== 'undefined' && !document.getElementById('avatar-hover-style')) {
  const style = document.createElement('style');
  style.id = 'avatar-hover-style';
  style.innerHTML = `
    .hover-scale-avatar { transition: transform var(--motion-duration-fast) var(--motion-ease-out), box-shadow var(--motion-duration-fast) var(--motion-ease-out); transform: scale(1); }
    .hover-scale-avatar:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(74,240,184,0.12); }
    @media (prefers-reduced-motion: reduce) { .hover-scale-avatar, .hover-scale-avatar:hover { transition: none !important; transform: none !important; box-shadow: none !important; } }
  `;
  document.head.appendChild(style);
}
