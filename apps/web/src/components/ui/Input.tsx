// apps/web/src/components/ui/Input.tsx
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={`
              w-full px-4 py-2 ${icon ? 'pl-10' : ''} 
              bg-gray-800 border border-gray-700 rounded-lg
              text-white placeholder-gray-500
              focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20
              transition-all duration-200
              ${error ? 'border-red-500' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';