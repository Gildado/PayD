import React from "react";
import { MD5 } from "crypto-js";

interface AvatarProps {
  email: string;
  name?: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  email,
  name = "User",
  imageUrl,
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-7 h-7 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-lg",
  };

  const getGravatarUrl = (email: string) => {
    const hash = MD5(email.toLowerCase().trim()).toString();
    return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=400`;
  };

  const avatarUrl = imageUrl || getGravatarUrl(email);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`${sizeClasses[size]} ${className} rounded-full overflow-hidden bg-gray-300 flex items-center justify-center shrink-0`}
      title={name}
    >
      <img
        src={avatarUrl}
        alt={name}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <span className="bg-linear-to-br from-blue-400 to-blue-600 text-white font-semibold hidden">
        {initials}
      </span>
    </div>
  );
};
