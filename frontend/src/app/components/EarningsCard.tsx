'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../apiClient';
import { SummaryCard } from './SummaryCard';

type WeeklyEarning = {
    weekStart: string;
    lessons: number;
    hours: number;
};

type EarningsData = {
    driverName: string;
    weeklyData: WeeklyEarning[];
    totals: {
        lessons: number;
        hours: number;
    };
};

interface EarningsCardProps {
    schoolId: number;
    driverId: number;
    token: string;
}

export function EarningsCard({ schoolId, driverId, token }: EarningsCardProps) {
    const [earnings, setEarnings] = useState<EarningsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEarnings();
    }, [schoolId, driverId, token]);

    async function loadEarnings() {
        if (!token || !schoolId || !driverId) return;
        setLoading(true);
        try {
            const data = await apiFetch<EarningsData>(
                `/schools/${schoolId}/drivers/${driverId}/earnings`,
                token
            );
            setEarnings(data);
        } catch (error) {
            console.error('Failed to load earnings:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <SummaryCard title="Activity Summary" description="Your lesson activity summary">
                <div className="text-slate-700 text-sm text-center py-4">Loading activity...</div>
            </SummaryCard>
        );
    }

    if (!earnings) {
        return (
            <SummaryCard title="Activity Summary" description="Your lesson activity summary">
                <div className="text-slate-700 text-sm text-center py-4">Unable to load activity data.</div>
            </SummaryCard>
        );
    }

    return (
        <SummaryCard title="Activity Summary" description="Your lesson activity summary (last 12 weeks)">
            <div className="space-y-4">
                {/* Totals Summary */}
                <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-slate-50 rounded p-3">
                        <p className="text-2xl font-bold text-blue-600">{earnings.totals.lessons}</p>
                        <p className="text-xs text-slate-600">Lessons</p>
                    </div>
                    <div className="bg-slate-50 rounded p-3">
                        <p className="text-2xl font-bold text-green-600">{earnings.totals.hours}h</p>
                        <p className="text-xs text-slate-600">Hours</p>
                    </div>
                </div>

                {/* Weekly Breakdown */}
                {earnings.weeklyData.length > 0 && (
                    <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="text-slate-600">
                                <tr className="border-b">
                                    <th className="py-1 text-left">Week</th>
                                    <th className="py-1 text-center">Lessons</th>
                                    <th className="py-1 text-center">Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {earnings.weeklyData.map((week) => (
                                    <tr key={week.weekStart} className="border-b border-slate-100">
                                        <td className="py-1 text-slate-700">
                                            {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="py-1 text-center">{week.lessons}</td>
                                        <td className="py-1 text-center">{week.hours}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {earnings.weeklyData.length === 0 && (
                    <p className="text-slate-700 text-sm text-center py-2">No completed lessons in the last 12 weeks.</p>
                )}
            </div>
        </SummaryCard>
    );
}
