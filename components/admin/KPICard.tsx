'use client';

import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  subtitle?: string;
}

export function KPICard({ title, value, icon: Icon, variant = 'default', subtitle }: KPICardProps) {
  const variantStyles = {
    default: 'border-gray-200 bg-white',
    warning: 'border-amber-300 bg-amber-50',
    success: 'border-green-300 bg-green-50',
    danger: 'border-red-300 bg-red-50',
  };

  const iconStyles = {
    default: 'text-blue-600',
    warning: 'text-amber-600',
    success: 'text-green-600',
    danger: 'text-red-600',
  };

  return (
    <div className={`rounded-lg border p-6 shadow-sm ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-semibold text-gray-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full bg-white shadow-sm ${iconStyles[variant]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
