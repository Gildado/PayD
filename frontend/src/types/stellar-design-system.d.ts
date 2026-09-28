/**
 * Type augmentation for @stellar/design-system
 * Fixes React 19 compatibility issues where components return Element instead of ReactNode
 */

import React from 'react';

declare module '@stellar/design-system' {
  import type { ReactNode, FC } from 'react';

  // Button component
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: ReactNode;
    variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    icon?: ReactNode;
    iconPosition?: 'left' | 'right';
    isLoading?: boolean;
    isFullWidth?: boolean;
    isRounded?: boolean;
    showActionTooltip?: boolean;
    actionTooltipText?: string;
    actionTooltipPlacement?: string;
  }

  export const Button: FC<ButtonProps>;

  // Card component
  export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
    variant?: string;
    noPadding?: boolean;
    borderRadiusSize?: string;
  }

  export const Card: FC<CardProps>;

  // Heading component
  export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children?: ReactNode;
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    size?: string;
    weight?: string;
    addlClassName?: string;
  }

  export const Heading: FC<HeadingProps>;

  // Text component
  export interface TextProps extends React.HTMLAttributes<HTMLElement> {
    children?: ReactNode;
    as?: 'p' | 'span' | 'div';
    size?: string;
    weight?: string;
    addlClassName?: string;
  }

  export const Text: FC<TextProps>;
}
