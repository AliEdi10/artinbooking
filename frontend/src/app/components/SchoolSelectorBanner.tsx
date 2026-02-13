'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../apiClient';

type School = { id: number; name: string };

interface SchoolSelectorBannerProps {
    selectedSchoolId: number | null;
    onSelect: (schoolId: number) => void;
}

/**
 * Banner shown to superadmins on school-scoped pages.
 * Fetches the list of schools and lets them pick which one to manage.
 * Returns null for non-superadmin users or when they already have a schoolId from JWT.
 */
export function SchoolSelectorBanner({ selectedSchoolId, onSelect }: SchoolSelectorBannerProps) {
    const { token, user } = useAuth();
    const [schools, setSchools] = useState<School[]>([]);

    const isSuperadmin = user?.role === 'superadmin';
    const hasJwtSchool = !!user?.schoolId;

    useEffect(() => {
        if (!token || !isSuperadmin) return;
        apiFetch<School[]>('/schools', token)
            .then(setSchools)
            .catch(() => {});
    }, [token, isSuperadmin]);

    // Don't render for non-superadmins or superadmins who already have a school in JWT
    if (!isSuperadmin || hasJwtSchool) return null;

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-medium text-amber-800">
                        Superadmin: Select a school to manage
                    </p>
                    <p className="text-xs text-amber-700">
                        Your account is not bound to a specific school. Pick one below.
                    </p>
                </div>
                <select
                    className="border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white min-w-[200px]"
                    value={selectedSchoolId ?? ''}
                    onChange={(e) => e.target.value && onSelect(Number(e.target.value))}
                >
                    <option value="">-- Select school --</option>
                    {schools.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}
