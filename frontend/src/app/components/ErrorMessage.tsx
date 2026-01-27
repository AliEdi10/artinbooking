'use client';

import React from 'react';

export type ErrorType = 'network' | 'unauthorized' | 'forbidden' | 'not_found' | 'server' | 'validation' | 'unknown';

interface ErrorMessageProps {
    type?: ErrorType;
    title?: string;
    message?: string;
    onRetry?: () => void;
    onLogin?: () => void;
    className?: string;
}

const errorConfig: Record<ErrorType, { icon: string; defaultTitle: string; defaultMessage: string; color: string }> = {
    network: {
        icon: '📡',
        defaultTitle: 'Connection Problem',
        defaultMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
        color: 'yellow',
    },
    unauthorized: {
        icon: '🔒',
        defaultTitle: 'Session Expired',
        defaultMessage: 'Your session has expired. Please sign in again to continue.',
        color: 'amber',
    },
    forbidden: {
        icon: '🚫',
        defaultTitle: 'Access Denied',
        defaultMessage: "You don't have permission to access this resource. Contact your administrator if you believe this is an error.",
        color: 'orange',
    },
    not_found: {
        icon: '🔍',
        defaultTitle: 'Not Found',
        defaultMessage: 'The requested resource could not be found. It may have been moved or deleted.',
        color: 'slate',
    },
    server: {
        icon: '⚙️',
        defaultTitle: 'Server Error',
        defaultMessage: 'Something went wrong on our end. Please try again in a few moments.',
        color: 'red',
    },
    validation: {
        icon: '⚠️',
        defaultTitle: 'Invalid Input',
        defaultMessage: 'Please check your input and try again.',
        color: 'yellow',
    },
    unknown: {
        icon: '❓',
        defaultTitle: 'Something Went Wrong',
        defaultMessage: 'An unexpected error occurred. Please try again.',
        color: 'slate',
    },
};

const colorClasses: Record<string, { bg: string; border: string; icon: string }> = {
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'bg-orange-100' },
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'bg-slate-100' },
};

/**
 * Reusable error message component with consistent styling for different error types
 */
export function ErrorMessage({
    type = 'unknown',
    title,
    message,
    onRetry,
    onLogin,
    className = '',
}: ErrorMessageProps) {
    const config = errorConfig[type];
    const colors = colorClasses[config.color];

    return (
        <div className={`${colors.bg} border ${colors.border} rounded-lg p-4 ${className}`}>
            <div className="flex items-start gap-3">
                <div className={`${colors.icon} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
                    <span className="text-xl">{config.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm">
                        {title || config.defaultTitle}
                    </h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                        {message || config.defaultMessage}
                    </p>
                    {(onRetry || onLogin) && (
                        <div className="flex gap-2 mt-3">
                            {onRetry && (
                                <button
                                    onClick={onRetry}
                                    className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 min-h-[32px]"
                                >
                                    Try Again
                                </button>
                            )}
                            {type === 'unauthorized' && onLogin && (
                                <button
                                    onClick={onLogin}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 min-h-[32px]"
                                >
                                    Sign In
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Inline error message for forms and compact spaces
 */
export function InlineError({ message, className = '' }: { message: string; className?: string }) {
    return (
        <p className={`text-sm text-red-600 flex items-center gap-1 ${className}`}>
            <span className="text-xs">⚠️</span>
            {message}
        </p>
    );
}

/**
 * Parse API error response and return appropriate error type
 */
export function getErrorType(status: number): ErrorType {
    switch (status) {
        case 0:
            return 'network';
        case 401:
            return 'unauthorized';
        case 403:
            return 'forbidden';
        case 404:
            return 'not_found';
        case 422:
        case 400:
            return 'validation';
        case 500:
        case 502:
        case 503:
        case 504:
            return 'server';
        default:
            return 'unknown';
    }
}
