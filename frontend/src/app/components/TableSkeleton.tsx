'use client';

import React from 'react';
import { Skeleton, SkeletonBadge } from './Skeleton';

interface TableSkeletonProps {
    columns?: number;
    rows?: number;
    showHeader?: boolean;
    className?: string;
}

/**
 * Table skeleton loader for tabular data
 */
export function TableSkeleton({
    columns = 4,
    rows = 5,
    showHeader = true,
    className = '',
}: TableSkeletonProps) {
    return (
        <div className={`overflow-hidden border rounded-lg ${className}`}>
            <table className="w-full">
                {showHeader && (
                    <thead className="bg-slate-100">
                        <tr>
                            {Array.from({ length: columns }).map((_, i) => (
                                <th key={i} className="px-4 py-3 text-left">
                                    <Skeleton width={`${60 + Math.random() * 40}%`} height={14} rounded="sm" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody className="divide-y divide-slate-100">
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <tr key={rowIndex} className="bg-white">
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <td key={colIndex} className="px-4 py-3">
                                    {colIndex === 0 ? (
                                        <div className="flex items-center gap-3">
                                            <Skeleton width={32} height={32} rounded="full" />
                                            <div>
                                                <Skeleton width={100} height={14} className="mb-1" />
                                                <Skeleton width={80} height={10} rounded="sm" />
                                            </div>
                                        </div>
                                    ) : colIndex === columns - 1 ? (
                                        <SkeletonBadge />
                                    ) : (
                                        <Skeleton width={`${50 + Math.random() * 50}%`} height={14} />
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Simple list skeleton for compact lists
 */
export function ListSkeleton({
    rows = 5,
    showAvatar = false,
    showBadge = false,
    className = '',
}: {
    rows?: number;
    showAvatar?: boolean;
    showBadge?: boolean;
    className?: string;
}) {
    return (
        <div className={`divide-y divide-slate-100 ${className}`}>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 flex-1">
                        {showAvatar && <Skeleton width={36} height={36} rounded="full" />}
                        <div className="flex-1">
                            <Skeleton width={`${60 + Math.random() * 30}%`} height={14} className="mb-1" />
                            <Skeleton width={`${40 + Math.random() * 30}%`} height={10} rounded="sm" />
                        </div>
                    </div>
                    {showBadge && <SkeletonBadge />}
                </div>
            ))}
        </div>
    );
}

/**
 * Grid of card skeletons
 */
export function CardGridSkeleton({
    columns = 3,
    rows = 1,
    className = '',
}: {
    columns?: number;
    rows?: number;
    className?: string;
}) {
    return (
        <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-4 ${className}`}>
            {Array.from({ length: columns * rows }).map((_, i) => (
                <div key={i} className="bg-white border rounded-xl p-5 shadow-sm">
                    <Skeleton width={120} height={16} className="mb-3" />
                    <Skeleton width="90%" height={12} rounded="sm" className="mb-4" />
                    <div className="space-y-2">
                        <Skeleton width="100%" height={14} />
                        <Skeleton width="85%" height={14} />
                        <Skeleton width="70%" height={14} />
                    </div>
                </div>
            ))}
        </div>
    );
}
