'use client';

import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
    animate?: boolean;
}

const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
};

/**
 * Basic skeleton loader component with shimmer animation
 */
export function Skeleton({
    className = '',
    width,
    height,
    rounded = 'md',
    animate = true,
}: SkeletonProps) {
    const style: React.CSSProperties = {};
    if (width) style.width = typeof width === 'number' ? `${width}px` : width;
    if (height) style.height = typeof height === 'number' ? `${height}px` : height;

    return (
        <div
            className={`
        bg-slate-200 
        ${roundedClasses[rounded]} 
        ${animate ? 'animate-pulse' : ''} 
        ${className}
      `}
            style={style}
        />
    );
}

/**
 * Text skeleton - for simulating text content
 */
export function SkeletonText({
    lines = 1,
    className = '',
    lastLineWidth = '60%',
}: {
    lines?: number;
    className?: string;
    lastLineWidth?: string;
}) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    height={16}
                    width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
                    rounded="sm"
                />
            ))}
        </div>
    );
}

/**
 * Avatar skeleton - circular placeholder for profile images
 */
export function SkeletonAvatar({
    size = 40,
    className = '',
}: {
    size?: number;
    className?: string;
}) {
    return (
        <Skeleton
            width={size}
            height={size}
            rounded="full"
            className={className}
        />
    );
}

/**
 * Button skeleton - for placeholder buttons
 */
export function SkeletonButton({
    width = 80,
    className = '',
}: {
    width?: number | string;
    className?: string;
}) {
    return (
        <Skeleton
            width={width}
            height={36}
            rounded="md"
            className={className}
        />
    );
}

/**
 * Input skeleton - for form inputs
 */
export function SkeletonInput({ className = '' }: { className?: string }) {
    return (
        <Skeleton
            width="100%"
            height={40}
            rounded="md"
            className={className}
        />
    );
}

/**
 * Badge skeleton - small pill-shaped placeholder
 */
export function SkeletonBadge({ className = '' }: { className?: string }) {
    return (
        <Skeleton
            width={60}
            height={22}
            rounded="full"
            className={className}
        />
    );
}
