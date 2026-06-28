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

  return (
    <div
      className={`${sizeClasses[size]} ${className} rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-2 ring-offset-1 transition-all`}
      style={{
        backgroundColor: 'var(--surface-hi)',
        ringColor: 'var(--border)',
        ringOffsetColor: 'var(--bg)',
      }}
      title={name}
      role="img"
      aria-label={name}
    >
      {!hasImageError ? (
        <img
          src={avatarUrl}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover"
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
          }}
        >
          {initials || '?'}
        </span>
      )}
    </div>
  );
};
