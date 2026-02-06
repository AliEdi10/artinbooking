'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../apiClient';
import { SummaryCard } from './SummaryCard';

type AnalyticsSummary = {
    totalDrivers: number;
    totalStudents: number;
    upcomingBookings: number;
    lessonsThisWeek: number;
    lessonsThisMonth: number;
    cancellationRatePercent: number;
};

type WeeklyBooking = {
    weekStart: string;
    completed: number;
    scheduled: number;
    cancelled: number;
};

type DriverUtilization = {
    driverId: number;
    fullName: string;
    totalBookings: number;
    completedLessons: number;
    cancelledLessons: number;
    hoursWorked: number;
};

type AuditLog = {
    id: number;
    actorUserId: number | null;
    action: string;
    entityType: string | null;
    entityId: number | null;
    details: Record<string, unknown> | null;
    createdAt: string;
};

interface AnalyticsDashboardProps {
    schoolId: number;
    token: string;
}

export function AnalyticsDashboard({ schoolId, token }: AnalyticsDashboardProps) {
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [weeklyData, setWeeklyData] = useState<WeeklyBooking[]>([]);
    const [driverStats, setDriverStats] = useState<DriverUtilization[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'audit'>('overview');

    useEffect(() => {
        loadAnalytics();
    }, [schoolId, token]);

    async function loadAnalytics() {
        if (!token || !schoolId) return;
        setLoading(true);
        try {
            const [summaryData, weekly, drivers, logs] = await Promise.all([
                apiFetch<AnalyticsSummary>(`/schools/${schoolId}/analytics/summary`, token),
                apiFetch<WeeklyBooking[]>(`/schools/${schoolId}/analytics/bookings-by-week`, token),
                apiFetch<DriverUtilization[]>(`/schools/${schoolId}/analytics/driver-utilization`, token),
                apiFetch<{ logs: AuditLog[]; total: number }>(`/schools/${schoolId}/audit-logs?limit=20`, token),
            ]);
            setSummary(summaryData);
            setWeeklyData(weekly);
            setDriverStats(drivers);
            setAuditLogs(logs.logs);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="text-center py-8 text-slate-800">
                Loading analytics...
            </div>
        );
    }

    const maxWeeklyTotal = Math.max(...weeklyData.map(w => w.completed + w.scheduled + w.cancelled), 1);

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-slate-200 pb-2">
                {(['overview', 'drivers', 'audit'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${activeTab === tab
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-800 hover:bg-slate-100'
                            }`}
                    >
                        {tab === 'overview' ? '📊 Overview' : tab === 'drivers' ? '🚗 Drivers' : '📜 Audit Log'}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && summary && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard label="Instructors" value={summary.totalDrivers} icon="👨‍🏫" />
                        <StatCard label="Students" value={summary.totalStudents} icon="🎓" />
                        <StatCard label="Upcoming" value={summary.upcomingBookings} icon="📅" />
                        <StatCard label="This Week" value={summary.lessonsThisWeek} icon="📆" />
                        <StatCard label="This Month" value={summary.lessonsThisMonth} icon="📈" />
                        <StatCard
                            label="Cancel Rate"
                            value={`${summary.cancellationRatePercent}%`}
                            icon="❌"
                            color={summary.cancellationRatePercent > 20 ? 'red' : 'green'}
                        />
                    </div>

                    {/* Weekly Chart */}
                    <SummaryCard title="Weekly Bookings (Last 8 Weeks)" description="Lesson activity over time">
                        <div className="space-y-3">
                            {weeklyData.length === 0 ? (
                                <p className="text-slate-700 text-sm text-center py-4">No booking data available yet.</p>
                            ) : (
                                weeklyData.map((week) => {
                                    const total = week.completed + week.scheduled + week.cancelled;
                                    return (
                                        <div key={week.weekStart} className="flex items-center gap-3">
                                            <span className="text-xs text-slate-800 w-24">
                                                {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <div className="flex-1 flex h-6 rounded overflow-hidden bg-slate-100">
                                                {week.completed > 0 && (
                                                    <div
                                                        className="bg-green-500 h-full"
                                                        style={{ width: `${(week.completed / maxWeeklyTotal) * 100}%` }}
                                                        title={`Completed: ${week.completed}`}
                                                    />
                                                )}
                                                {week.scheduled > 0 && (
                                                    <div
                                                        className="bg-blue-500 h-full"
                                                        style={{ width: `${(week.scheduled / maxWeeklyTotal) * 100}%` }}
                                                        title={`Scheduled: ${week.scheduled}`}
                                                    />
                                                )}
                                                {week.cancelled > 0 && (
                                                    <div
                                                        className="bg-red-400 h-full"
                                                        style={{ width: `${(week.cancelled / maxWeeklyTotal) * 100}%` }}
                                                        title={`Cancelled: ${week.cancelled}`}
                                                    />
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-700 w-8 text-right">{total}</span>
                                        </div>
                                    );
                                })
                            )}
                            <div className="flex gap-4 justify-center text-xs mt-2">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Completed</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Scheduled</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded"></span> Cancelled</span>
                            </div>
                        </div>
                    </SummaryCard>
                </div>
            )}

            {/* Drivers Tab */}
            {activeTab === 'drivers' && (
                <SummaryCard title="Driver Utilization (Last 30 Days)" description="Performance by instructor">
                    {driverStats.length === 0 ? (
                        <p className="text-slate-700 text-sm text-center py-4">No driver data available.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-800 border-b">
                                        <th className="py-2">Instructor</th>
                                        <th className="py-2 text-center">Bookings</th>
                                        <th className="py-2 text-center">Completed</th>
                                        <th className="py-2 text-center">Cancelled</th>
                                        <th className="py-2 text-right">Hours</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {driverStats.map((driver) => (
                                        <tr key={driver.driverId} className="border-b border-slate-100">
                                            <td className="py-2 font-medium text-slate-800">{driver.fullName}</td>
                                            <td className="py-2 text-center">{driver.totalBookings}</td>
                                            <td className="py-2 text-center text-green-600">{driver.completedLessons}</td>
                                            <td className="py-2 text-center text-red-500">{driver.cancelledLessons}</td>
                                            <td className="py-2 text-right text-slate-800">{driver.hoursWorked}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SummaryCard>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit' && (
                <SummaryCard title="Recent Activity" description="Audit log of system changes">
                    {auditLogs.length === 0 ? (
                        <p className="text-slate-700 text-sm text-center py-4">No activity recorded yet.</p>
                    ) : (
                        <ul className="space-y-2 max-h-96 overflow-y-auto">
                            {auditLogs.map((log) => (
                                <li key={log.id} className="flex items-start gap-3 text-sm border-b border-slate-100 pb-2">
                                    <span className="text-slate-400 text-xs whitespace-nowrap">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </span>
                                    <span className="text-slate-800">
                                        <strong className="text-slate-800">{log.action}</strong>
                                        {log.entityType && (
                                            <span className="text-slate-700"> on {log.entityType} #{log.entityId}</span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </SummaryCard>
            )}
        </div>
    );
}

function StatCard({ label, value, icon, color = 'blue' }: { label: string; value: string | number; icon: string; color?: 'blue' | 'green' | 'red' }) {
    const colorClass = color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : 'text-blue-600';
    return (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{icon}</span>
                <span className="text-xs text-slate-700">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        </div>
    );
}
