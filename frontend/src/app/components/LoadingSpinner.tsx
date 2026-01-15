'use client';

import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function LoadingSpinner({ message, size = 'md', className = '' }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-6 h-6 border-2',
        lg: 'w-10 h-10 border-3',
    };

    return (
        <div className={`flex items-center justify-center gap-2 ${className}`}>
            <div
                className={`${sizeClasses[size]} border-slate-300 border-t-blue-600 rounded-full animate-spin`}
            />
            {message && <span className="text-sm text-slate-600">{message}</span>}
        </div>
    );
}

interface LoadingOverlayProps {
    message?: string;
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingOverlayProps) {
    return (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
            <LoadingSpinner message={message} size="lg" />
        </div>
    );
}
