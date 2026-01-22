// apps/web/src/components/ui/Button.tsx

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, className = '', ...props }, ref) => {
    const baseStyles = 'font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2';
    
    const variantStyles = {
      primary: 'bg-cyan-400 hover:bg-cyan-500 text-gray-900',
      secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
      danger: 'bg-red-600 hover:bg-red-700 text-white',
      ghost: 'bg-transparent hover:bg-gray-800 text-cyan-400 border border-gray-700',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg w-full',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <span className="animate-spin">⏳</span>}
        {props.children}
      </button>
    );
  }
);

Button.displayName = 'Button';
