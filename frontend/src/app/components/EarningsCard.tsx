'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../apiClient';
import { SummaryCard } from './SummaryCard';

type WeeklyEarning = {
    weekStart: string;
    lessons: number;
    hours: number;
    earnings: number | null;
};

type EarningsData = {
    driverName: string;
    hourlyRate: number | null;
    weeklyData: WeeklyEarning[];
    totals: {
        lessons: number;
        hours: number;
        earnings: number | null;
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
    const [exporting, setExporting] = useState(false);

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

    async function handleExportCSV() {
        if (!token || !schoolId || !driverId) return;
        setExporting(true);
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/schools/${schoolId}/drivers/${driverId}/earnings/export`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `earnings-${earnings?.driverName?.replace(/\s+/g, '_') || 'report'}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setExporting(false);
        }
    }

    if (loading) {
        return (
            <SummaryCard title="Earnings" description="Your lesson earnings summary">
                <div className="text-slate-500 text-sm text-center py-4">Loading earnings...</div>
            </SummaryCard>
        );
    }

    if (!earnings) {
        return (
            <SummaryCard title="Earnings" description="Your lesson earnings summary">
                <div className="text-slate-500 text-sm text-center py-4">Unable to load earnings data.</div>
            </SummaryCard>
        );
    }

    return (
        <SummaryCard title="Earnings" description="Your lesson earnings summary (last 12 weeks)">
            <div className="space-y-4">
                {/* Totals Summary */}
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-50 rounded p-3">
                        <p className="text-2xl font-bold text-blue-600">{earnings.totals.lessons}</p>
                        <p className="text-xs text-slate-600">Lessons</p>
                    </div>
                    <div className="bg-slate-50 rounded p-3">
                        <p className="text-2xl font-bold text-green-600">{earnings.totals.hours}h</p>
                        <p className="text-xs text-slate-600">Hours</p>
                    </div>
                    <div className="bg-slate-50 rounded p-3">
                        <p className="text-2xl font-bold text-emerald-600">
                            {earnings.totals.earnings !== null ? `$${earnings.totals.earnings.toFixed(2)}` : '—'}
                        </p>
                        <p className="text-xs text-slate-600">Earnings</p>
                    </div>
                </div>

                {/* Hourly Rate Notice */}
                {earnings.hourlyRate === null && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        💡 Earnings are not calculated because your hourly rate is not set. Contact your admin to configure it.
                    </p>
                )}

                {/* Weekly Breakdown */}
                {earnings.weeklyData.length > 0 && (
                    <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="text-slate-600">
                                <tr className="border-b">
                                    <th className="py-1 text-left">Week</th>
                                    <th className="py-1 text-center">Lessons</th>
                                    <th className="py-1 text-center">Hours</th>
                                    <th className="py-1 text-right">Earnings</th>
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
                                        <td className="py-1 text-right text-emerald-600">
                                            {week.earnings !== null ? `$${week.earnings.toFixed(2)}` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {earnings.weeklyData.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-2">No completed lessons in the last 12 weeks.</p>
                )}

                {/* Export Button */}
                <button
                    onClick={handleExportCSV}
                    disabled={exporting || earnings.weeklyData.length === 0}
                    className="w-full text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {exporting ? 'Exporting...' : '📥 Export CSV'}
                </button>
            </div>
        </SummaryCard>
    );
}
