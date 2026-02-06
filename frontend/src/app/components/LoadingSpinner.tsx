'use client';

import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
};

export function LoadingSpinner({ message, size = 'md', className = '' }: LoadingSpinnerProps) {
    return (
        <div className={`flex items-center justify-center gap-2 ${className}`}>
            <div
                className={`${sizeClasses[size]} border-slate-300 border-t-blue-600 rounded-full animate-spin`}
            />
            {message && <span className="text-sm text-slate-700">{message}</span>}
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

/**
 * Full-page loading overlay with blur backdrop
 */
export function FullPageLoading({ message = 'Loading...' }: { message?: string }) {
    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
                <LoadingSpinner size="xl" className="mx-auto mb-4" />
                <p className="text-sm text-slate-700 font-medium">{message}</p>
            </div>
        </div>
    );
}

/**
 * Inline loading indicator with message
 */
export function LoadingInline({
    message = 'Loading...',
    size = 'md',
    className = ''
}: {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <LoadingSpinner size={size} />
            <span className="text-sm text-slate-700">{message}</span>
        </div>
    );
}

/**
 * Card-style loading state
 */
export function LoadingCard({
    message = 'Loading...',
    className = ''
}: {
    message?: string;
    className?: string;
}) {
    return (
        <div className={`bg-white border border-slate-200 rounded-xl p-8 shadow-sm ${className}`}>
            <div className="text-center">
                <LoadingSpinner size="lg" className="mx-auto mb-3" />
                <p className="text-sm text-slate-700">{message}</p>
            </div>
        </div>
    );
}

/**
 * Page-level loading state (centered in content area)
 */
export function PageLoading({
    message = 'Loading...',
    className = ''
}: {
    message?: string;
    className?: string;
}) {
    return (
        <div className={`flex items-center justify-center min-h-[300px] ${className}`}>
            <div className="text-center">
                <LoadingSpinner size="xl" className="mx-auto mb-4" />
                <p className="text-slate-700 font-medium">{message}</p>
            </div>
        </div>
    );
}
