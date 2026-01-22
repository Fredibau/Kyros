// apps/web/src/components/ui/Card.tsx
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className = '', children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-gray-900 border border-gray-800',
      elevated: 'bg-gray-800 shadow-lg',
      outlined: 'bg-transparent border border-gray-700',
    };

    return (
      <div
        ref={ref}
        className={`rounded-lg p-6 ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';