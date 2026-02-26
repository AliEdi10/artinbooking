'use client';

import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, API_BASE } from '../apiClient';
import { SummaryCard } from './SummaryCard';
import { formatDateCustom, formatDateTime } from '../utils/timezone';

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

type SignupData = {
    count: number;
    days: number;
};

type ActiveInactiveData = {
    drivers: { active: number; inactive: number };
    students: { active: number; inactive: number };
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

export type AdminTab = 'overview' | 'drivers' | 'audit' | 'reports';

interface AnalyticsDashboardProps {
    schoolId: number;
    token: string;
    activeTab: AdminTab;
    onTabChange: (tab: AdminTab) => void;
}

export function AnalyticsDashboard({ schoolId, token, activeTab, onTabChange }: AnalyticsDashboardProps) {
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [weeklyData, setWeeklyData] = useState<WeeklyBooking[]>([]);
    const [driverStats, setDriverStats] = useState<DriverUtilization[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [signupDays, setSignupDays] = useState(30);
    const [signupData, setSignupData] = useState<SignupData | null>(null);
    const [activeInactive, setActiveInactive] = useState<ActiveInactiveData | null>(null);
    const [loading, setLoading] = useState(true);

    // Reports tab state
    const [reportDrivers, setReportDrivers] = useState<{ id: number; fullName: string }[]>([]);
    const [reportFilters, setReportFilters] = useState({ driverId: '', startDate: '', endDate: '' });
    const [isDownloading, setIsDownloading] = useState<string | null>(null);

    useEffect(() => {
        loadAnalytics();
    }, [schoolId, token]);

    // Debounced signups fetch — avoids rapid refetches when changing date range
    const signupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!token || !schoolId) return;
        if (signupTimerRef.current) clearTimeout(signupTimerRef.current);
        signupTimerRef.current = setTimeout(() => {
            apiFetch<SignupData>(`/schools/${schoolId}/analytics/signups?days=${signupDays}`, token)
                .then(setSignupData)
                .catch(() => { });
        }, 300);
        return () => { if (signupTimerRef.current) clearTimeout(signupTimerRef.current); };
    }, [schoolId, token, signupDays]);

    // Lazy-load driver utilization only when driver tab is active
    useEffect(() => {
        if (activeTab !== 'drivers' || !token || !schoolId || driverStats.length > 0) return;
        apiFetch<DriverUtilization[]>(`/schools/${schoolId}/analytics/driver-utilization`, token)
            .then(setDriverStats)
            .catch(() => { });
    }, [activeTab, schoolId, token]);

    // Lazy-load audit logs only when audit tab is active
    useEffect(() => {
        if (activeTab !== 'audit' || !token || !schoolId || auditLogs.length > 0) return;
        apiFetch<{ logs: AuditLog[]; total: number }>(`/schools/${schoolId}/audit-logs?limit=20`, token)
            .then(data => setAuditLogs(data.logs))
            .catch(() => { });
    }, [activeTab, schoolId, token]);

    // Lazy-load driver list for the reports instructor filter
    useEffect(() => {
        if (activeTab !== 'reports' || !token || !schoolId || reportDrivers.length > 0) return;
        apiFetch<{ id: number; fullName: string }[]>(`/schools/${schoolId}/drivers`, token)
            .then(setReportDrivers)
            .catch(() => { });
    }, [activeTab, schoolId, token]);

    async function downloadCsv(path: string, filename: string) {
        setIsDownloading(filename);
        try {
            const resp = await fetch(`${API_BASE}${path}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!resp.ok) throw new Error('Export failed');
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            // silently fail — user will notice no download occurred
        } finally {
            setIsDownloading(null);
        }
    }

    function buildReportUrl(base: string) {
        const params = new URLSearchParams();
        if (reportFilters.driverId) params.set('driverId', reportFilters.driverId);
        if (reportFilters.startDate) params.set('startDate', reportFilters.startDate);
        if (reportFilters.endDate) params.set('endDate', reportFilters.endDate);
        const qs = params.toString();
        return `/schools/${schoolId}/${base}${qs ? `?${qs}` : ''}`;
    }

    async function loadAnalytics() {
        if (!token || !schoolId) return;
        setLoading(true);
        try {
            // Only fetch overview data on initial load (4 calls instead of 6)
            // Driver stats and audit logs are lazy-loaded when their tabs are opened
            const [summaryData, weekly, signups, actInact] = await Promise.all([
                apiFetch<AnalyticsSummary>(`/schools/${schoolId}/analytics/summary`, token),
                apiFetch<WeeklyBooking[]>(`/schools/${schoolId}/analytics/bookings-by-week`, token),
                apiFetch<SignupData>(`/schools/${schoolId}/analytics/signups?days=${signupDays}`, token),
                apiFetch<ActiveInactiveData>(`/schools/${schoolId}/analytics/active-inactive`, token),
            ]);
            setSummary(summaryData);
            setWeeklyData(weekly);
            setSignupData(signups);
            setActiveInactive(actInact);
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
            <div className="flex gap-2 border-b border-slate-200 pb-2 flex-wrap">
                {(['overview', 'drivers', 'audit', 'reports'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => onTabChange(tab)}
                        className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${activeTab === tab
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-800 hover:bg-slate-100'
                            }`}
                    >
                        {tab === 'overview' ? '📊 Overview' : tab === 'drivers' ? '🚗 Drivers' : tab === 'audit' ? '📜 Audit Log' : '📥 Reports'}
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

                    {/* Signups + Active/Inactive Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* New Signups Card */}
                        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-700">New Signups</span>
                                <select
                                    value={signupDays}
                                    onChange={(e) => setSignupDays(Number(e.target.value))}
                                    className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-800"
                                >
                                    <option value={7}>7 days</option>
                                    <option value={30}>30 days</option>
                                    <option value={90}>3 months</option>
                                    <option value={180}>6 months</option>
                                    <option value={365}>1 year</option>
                                </select>
                            </div>
                            <p className="text-3xl font-bold text-blue-600">{signupData?.count ?? '—'}</p>
                            <p className="text-xs text-slate-500 mt-1">students in the last {signupDays} days</p>
                        </div>

                        {/* Active/Inactive Drivers */}
                        {activeInactive && (
                            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                                <span className="text-sm font-medium text-slate-700">Instructors</span>
                                <div className="mt-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">Active</span>
                                        <span className="text-lg font-bold text-green-600">{activeInactive.drivers.active}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">Inactive</span>
                                        <span className="text-lg font-bold text-slate-400">{activeInactive.drivers.inactive}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${activeInactive.drivers.active + activeInactive.drivers.inactive > 0 ? (activeInactive.drivers.active / (activeInactive.drivers.active + activeInactive.drivers.inactive)) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Active/Inactive Students */}
                        {activeInactive && (
                            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                                <span className="text-sm font-medium text-slate-700">Students</span>
                                <div className="mt-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">Active</span>
                                        <span className="text-lg font-bold text-green-600">{activeInactive.students.active}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">Inactive</span>
                                        <span className="text-lg font-bold text-slate-400">{activeInactive.students.inactive}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${activeInactive.students.active + activeInactive.students.inactive > 0 ? (activeInactive.students.active / (activeInactive.students.active + activeInactive.students.inactive)) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
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
                                                {formatDateCustom(week.weekStart, { month: 'short', day: 'numeric' })}
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
                            <div className="flex gap-4 justify-center text-xs text-slate-900 mt-2">
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
                                        {formatDateTime(log.createdAt)}
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

            {/* Reports Tab */}
            {activeTab === 'reports' && (
                <div className="space-y-4">
                    {/* Shared filters */}
                    <SummaryCard title="Export Filters" description="Apply filters to all reports below. Leave blank to export all records.">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Instructor</label>
                                <select
                                    className="w-full border rounded px-3 py-2 text-slate-900 bg-white"
                                    value={reportFilters.driverId}
                                    onChange={(e) => setReportFilters((f) => ({ ...f, driverId: e.target.value }))}
                                >
                                    <option value="">All instructors</option>
                                    {reportDrivers.map((d) => (
                                        <option key={d.id} value={String(d.id)}>{d.fullName}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    className="w-full border rounded px-3 py-2 text-slate-900"
                                    value={reportFilters.startDate}
                                    onChange={(e) => setReportFilters((f) => ({ ...f, startDate: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                                <input
                                    type="date"
                                    className="w-full border rounded px-3 py-2 text-slate-900"
                                    value={reportFilters.endDate}
                                    onChange={(e) => setReportFilters((f) => ({ ...f, endDate: e.target.value }))}
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline"
                            onClick={() => setReportFilters({ driverId: '', startDate: '', endDate: '' })}
                        >
                            Clear filters
                        </button>
                    </SummaryCard>

                    {/* Report cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SummaryCard
                            title="Completed & Cancelled Classes"
                            description="All lessons that have been completed or cancelled. Includes duration, status, and cancellation reason."
                        >
                            <p className="text-xs text-slate-600 mb-4">
                                Columns: Instructor, Student, Date, Start Time, End Time, Duration (min), Status, Cancellation Reason
                            </p>
                            <button
                                type="button"
                                className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                                disabled={isDownloading === 'completed-classes.csv'}
                                onClick={() => downloadCsv(buildReportUrl('reports/completed-classes.csv'), 'completed-classes.csv')}
                            >
                                {isDownloading === 'completed-classes.csv' ? 'Exporting...' : '⬇ Export CSV'}
                            </button>
                        </SummaryCard>

                        <SummaryCard
                            title="Instructor Off-Days"
                            description="Days where instructors have marked themselves unavailable."
                        >
                            <p className="text-xs text-slate-600 mb-4">
                                Columns: Instructor, Date, Notes
                            </p>
                            <button
                                type="button"
                                className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                                disabled={isDownloading === 'off-days.csv'}
                                onClick={() => downloadCsv(buildReportUrl('reports/off-days.csv'), 'off-days.csv')}
                            >
                                {isDownloading === 'off-days.csv' ? 'Exporting...' : '⬇ Export CSV'}
                            </button>
                        </SummaryCard>

                        <SummaryCard
                            title="Future Schedule"
                            description="All upcoming scheduled lessons that have not yet taken place."
                        >
                            <p className="text-xs text-slate-600 mb-4">
                                Columns: Instructor, Student, Date, Start Time, End Time, Duration (min), Status
                            </p>
                            <button
                                type="button"
                                className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                                disabled={isDownloading === 'future-schedule.csv'}
                                onClick={() => downloadCsv(buildReportUrl('reports/future-schedule.csv'), 'future-schedule.csv')}
                            >
                                {isDownloading === 'future-schedule.csv' ? 'Exporting...' : '⬇ Export CSV'}
                            </button>
                        </SummaryCard>
                    </div>
                </div>
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
