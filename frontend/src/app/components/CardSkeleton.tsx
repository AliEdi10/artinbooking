'use client';

import React from 'react';
import { Skeleton, SkeletonText, SkeletonBadge } from './Skeleton';

/**
 * Skeleton loader for SummaryCard component
 * Matches the structure and dimensions of the actual SummaryCard
 */
export function CardSkeleton({
    showList = true,
    listItems = 3,
    showForm = false,
    className = ''
}: {
    showList?: boolean;
    listItems?: number;
    showForm?: boolean;
    className?: string;
}) {
    return (
        <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm ${className}`}>
            {/* Header */}
            <div className="mb-4">
                <Skeleton width={140} height={20} className="mb-2" />
                <Skeleton width="80%" height={14} rounded="sm" />
            </div>

            {/* List items */}
            {showList && (
                <div className="space-y-3 mb-4">
                    {Array.from({ length: listItems }).map((_, i) => (
                        <div key={i} className="border rounded-lg p-3 bg-slate-50">
                            <div className="flex justify-between items-center">
                                <div className="flex-1">
                                    <Skeleton width="60%" height={16} className="mb-2" />
                                    <Skeleton width="40%" height={12} rounded="sm" />
                                </div>
                                <SkeletonBadge />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form skeleton */}
            {showForm && (
                <div className="space-y-3 mt-4 pt-4 border-t">
                    <Skeleton width="30%" height={12} rounded="sm" />
                    <Skeleton width="100%" height={40} />
                    <Skeleton width="100%" height={40} />
                    <Skeleton width="100%" height={36} />
                </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t mt-4">
                <Skeleton width="70%" height={11} rounded="sm" />
            </div>
        </div>
    );
}

/**
 * Booking list skeleton
 */
export function BookingListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4 bg-slate-50">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                            <Skeleton width={180} height={18} className="mb-2" />
                            <Skeleton width={120} height={14} rounded="sm" />
                        </div>
                        <SkeletonBadge />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton width={100} height={32} />
                        <Skeleton width={80} height={32} />
                        <Skeleton width={80} height={32} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Student/Driver profile skeleton
 */
export function ProfileSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <Skeleton width={64} height={64} rounded="full" />
                <div className="flex-1">
                    <Skeleton width={160} height={20} className="mb-2" />
                    <Skeleton width={120} height={14} rounded="sm" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Skeleton width={60} height={12} rounded="sm" className="mb-1" />
                    <Skeleton width="100%" height={16} />
                </div>
                <div>
                    <Skeleton width={60} height={12} rounded="sm" className="mb-1" />
                    <Skeleton width="100%" height={16} />
                </div>
                <div>
                    <Skeleton width={60} height={12} rounded="sm" className="mb-1" />
                    <Skeleton width="100%" height={16} />
                </div>
                <div>
                    <Skeleton width={60} height={12} rounded="sm" className="mb-1" />
                    <Skeleton width="100%" height={16} />
                </div>
            </div>
        </div>
    );
}

/**
 * Address list skeleton
 */
export function AddressListSkeleton({ count = 2 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="border rounded-lg p-3 bg-slate-50">
                    <Skeleton width={80} height={16} className="mb-2" />
                    <Skeleton width="90%" height={12} rounded="sm" className="mb-1" />
                    <Skeleton width="70%" height={12} rounded="sm" />
                </div>
            ))}
        </div>
    );
}

/**
 * Time slot list skeleton
 */
export function SlotListSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                    <div className="flex-1">
                        <Skeleton width={140} height={16} className="mb-1" />
                        <Skeleton width={100} height={12} rounded="sm" />
                    </div>
                    <Skeleton width={100} height={36} />
                </div>
            ))}
        </div>
    );
}

/**
 * Stats/metrics grid skeleton
 */
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-4 border">
                    <Skeleton width="60%" height={12} rounded="sm" className="mb-2" />
                    <Skeleton width={60} height={28} className="mb-1" />
                    <Skeleton width="80%" height={10} rounded="sm" />
                </div>
            ))}
        </div>
    );
}

/**
 * Calendar/schedule skeleton
 */
export function CalendarSkeleton() {
    return (
        <div className="border rounded-lg p-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <Skeleton width={32} height={32} />
                <Skeleton width={140} height={20} />
                <Skeleton width={32} height={32} />
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} width="100%" height={24} rounded="sm" />
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} width="100%" height={40} rounded="sm" />
                ))}
            </div>
        </div>
    );
}
