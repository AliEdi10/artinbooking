'use client';

import React from 'react';

interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

/**
 * Empty state component for lists and pages with no data
 * Provides a clean placeholder with optional action button
 */
export function EmptyState({
    icon = '📭',
    title,
    description,
    action,
    className = '',
}: EmptyStateProps) {
    return (
        <div className={`text-center py-8 px-4 ${className}`}>
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">{icon}</span>
            </div>
            <h3 className="font-medium text-slate-900 mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-slate-700 max-w-sm mx-auto">{description}</p>
            )}
            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 min-h-[40px]"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

/**
 * Preset empty states for common scenarios
 */
export function NoBookingsEmpty({ onBook }: { onBook?: () => void }) {
    return (
        <EmptyState
            icon="📅"
            title="No bookings yet"
            description="You don't have any upcoming lessons scheduled."
            action={onBook ? { label: 'Book a Lesson', onClick: onBook } : undefined}
        />
    );
}

export function NoStudentsEmpty({ onInvite }: { onInvite?: () => void }) {
    return (
        <EmptyState
            icon="👥"
            title="No students yet"
            description="Invite students to start booking lessons."
            action={onInvite ? { label: 'Invite Student', onClick: onInvite } : undefined}
        />
    );
}

export function NoDriversEmpty({ onInvite }: { onInvite?: () => void }) {
    return (
        <EmptyState
            icon="🚗"
            title="No drivers yet"
            description="Invite instructors to enable lesson scheduling."
            action={onInvite ? { label: 'Invite Driver', onClick: onInvite } : undefined}
        />
    );
}

export function NoAddressesEmpty({ onAdd }: { onAdd?: () => void }) {
    return (
        <EmptyState
            icon="📍"
            title="No addresses yet"
            description="Add pickup and dropoff locations to book lessons."
            action={onAdd ? { label: 'Add Address', onClick: onAdd } : undefined}
        />
    );
}

export function NoResultsEmpty({ query }: { query?: string }) {
    return (
        <EmptyState
            icon="🔍"
            title="No results found"
            description={query ? `No results matching "${query}". Try adjusting your search.` : 'Try adjusting your filters.'}
        />
    );
}

export function NoSlotsEmpty() {
    return (
        <EmptyState
            icon="⏰"
            title="No available slots"
            description="No time slots available for the selected date and driver. Try a different day."
        />
    );
}
