'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Protected } from '../auth/Protected';
import { AppShell } from '../components/AppShell';
import { SummaryCard } from '../components/SummaryCard';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../apiClient';
import { PageLoading } from '../components/LoadingSpinner';

type SystemStatus = {
    uptime: { ms: number; formatted: string };
    database: {
        status: string;
        latencyMs: number | null;
        pool: { total: number; idle: number; waiting: number };
    };
    memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number };
    node: string;
};

type DrivingSchool = {
    id: number;
    name: string;
    contactEmail: string | null;
    status: 'active' | 'suspended' | 'deleted';
    createdAt: string;
};

type SchoolAdmin = {
    id: number;
    email: string;
    fullName: string | null;
    role: string;
    drivingSchoolId: number;
};

export default function SuperadminPage() {
    const { token } = useAuth();

    const [schools, setSchools] = useState<DrivingSchool[]>([]);
    const [admins, setAdmins] = useState<SchoolAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState('');

    const [schoolForm, setSchoolForm] = useState({ name: '', contactEmail: '' });
    const [adminForm, setAdminForm] = useState({ schoolId: '', email: '', fullName: '' });
    // Edit modal state
    const [editingSchool, setEditingSchool] = useState<DrivingSchool | null>(null);
    const [editForm, setEditForm] = useState({ name: '', contactEmail: '' });

    // Confirm action state
    const [confirmAction, setConfirmAction] = useState<{ schoolId: number; action: 'suspend' | 'activate' | 'delete'; schoolName: string } | null>(null);

    // System status
    const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

    const fetchSystemStatus = useCallback(() => {
        if (!token) return;
        apiFetch<SystemStatus>('/system/status', token)
            .then(setSystemStatus)
            .catch(() => setSystemStatus(null));
    }, [token]);

    useEffect(() => {
        fetchSystemStatus();
        const interval = setInterval(fetchSystemStatus, 30000);
        return () => clearInterval(interval);
    }, [fetchSystemStatus]);

    async function loadSchools() {
        if (!token) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const result = await apiFetch<DrivingSchool[]>('/schools', token);
            setSchools(result);
        } catch (err) {
            setError('Unable to load schools.');
        } finally {
            setLoading(false);
        }
    }

    async function loadAdmins() {
        if (!token) return;
        try {
            const result = await apiFetch<SchoolAdmin[]>('/users?role=SCHOOL_ADMIN', token);
            setAdmins(result);
        } catch (err) {
            console.error('Unable to load admins');
        }
    }

    useEffect(() => {
        loadSchools();
        loadAdmins();
    }, [token]);

    async function handleCreateSchool(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!token) return;
        setActionMessage('Creating school...');
        try {
            await apiFetch('/schools', token, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: schoolForm.name,
                    contactEmail: schoolForm.contactEmail || undefined,
                }),
            });
            setSchoolForm({ name: '', contactEmail: '' });
            await loadSchools();
            setActionMessage('School created successfully!');
        } catch (err) {
            setActionMessage('Unable to create school.');
        }
    }

    async function handleInviteAdmin(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!token || !adminForm.schoolId) return;
        setActionMessage('Sending invitation...');
        try {
            await apiFetch(`/schools/${adminForm.schoolId}/invitations`, token, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: adminForm.email,
                    role: 'SCHOOL_ADMIN',
                    fullName: adminForm.fullName || undefined,
                }),
            });
            setAdminForm({ schoolId: adminForm.schoolId, email: '', fullName: '' });
            setActionMessage('Invitation sent! Admin will receive an email to complete registration.');
        } catch (err) {
            setActionMessage('Unable to send invitation.');
        }
    }

    async function handleEditSchool() {
        if (!token || !editingSchool) return;
        setActionMessage('Updating school...');
        try {
            await apiFetch(`/schools/${editingSchool.id}`, token, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name,
                    contactEmail: editForm.contactEmail || null,
                }),
            });
            setEditingSchool(null);
            await loadSchools();
            setActionMessage('School updated successfully!');
        } catch (err) {
            setActionMessage('Unable to update school.');
        }
    }

    async function handleStatusChange(schoolId: number, status: 'active' | 'suspended' | 'deleted') {
        if (!token) return;
        const label = status === 'deleted' ? 'Deleting' : status === 'suspended' ? 'Suspending' : 'Activating';
        setActionMessage(`${label} school...`);
        setConfirmAction(null);
        try {
            await apiFetch(`/schools/${schoolId}/status`, token, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            await loadSchools();
            const doneLabel = status === 'deleted' ? 'deleted' : status === 'suspended' ? 'suspended' : 'activated';
            setActionMessage(`School ${doneLabel} successfully!`);
        } catch (err) {
            setActionMessage('Unable to update school status.');
        }
    }

    function openEdit(school: DrivingSchool) {
        setEditingSchool(school);
        setEditForm({ name: school.name, contactEmail: school.contactEmail || '' });
    }

    return (
        <Protected allowedRoles={['superadmin']}>
            <AppShell>
                {loading && schools.length === 0 ? <PageLoading message="Loading schools..." /> : <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Superadmin Dashboard</h1>
                        <p className="text-sm text-slate-800">
                            Manage driving schools and assign administrators.
                        </p>
                        {actionMessage && <p className="text-sm text-blue-700 mt-2">{actionMessage}</p>}
                        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
                    </div>

                    {/* Edit School Modal */}
                    {editingSchool && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Edit School</h2>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-800 mb-1">School Name</label>
                                        <input
                                            className="border rounded px-3 py-2 text-sm w-full text-slate-900"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-800 mb-1">Contact Email</label>
                                        <input
                                            className="border rounded px-3 py-2 text-sm w-full text-slate-900"
                                            type="email"
                                            value={editForm.contactEmail}
                                            onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={handleEditSchool}
                                            className="flex-1 bg-slate-900 text-white rounded px-3 py-2 text-sm hover:bg-slate-800"
                                        >
                                            Save Changes
                                        </button>
                                        <button
                                            onClick={() => setEditingSchool(null)}
                                            className="flex-1 border border-slate-300 text-slate-700 rounded px-3 py-2 text-sm hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Confirm Action Modal */}
                    {confirmAction && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
                                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                                    {confirmAction.action === 'delete' ? 'Delete School' : confirmAction.action === 'suspend' ? 'Suspend School' : 'Activate School'}
                                </h2>
                                <p className="text-sm text-slate-800 mb-4">
                                    {confirmAction.action === 'delete'
                                        ? `Are you sure you want to delete "${confirmAction.schoolName}"? This will prevent all operations on this school.`
                                        : confirmAction.action === 'suspend'
                                        ? `Are you sure you want to suspend "${confirmAction.schoolName}"? Users will not be able to make bookings.`
                                        : `Are you sure you want to activate "${confirmAction.schoolName}"?`}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleStatusChange(confirmAction.schoolId, confirmAction.action === 'activate' ? 'active' : confirmAction.action === 'suspend' ? 'suspended' : 'deleted')}
                                        className={`flex-1 text-white rounded px-3 py-2 text-sm ${
                                            confirmAction.action === 'delete' ? 'bg-red-600 hover:bg-red-700' :
                                            confirmAction.action === 'suspend' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                            'bg-green-600 hover:bg-green-700'
                                        }`}
                                    >
                                        {confirmAction.action === 'delete' ? 'Delete' : confirmAction.action === 'suspend' ? 'Suspend' : 'Activate'}
                                    </button>
                                    <button
                                        onClick={() => setConfirmAction(null)}
                                        className="flex-1 border border-slate-300 text-slate-700 rounded px-3 py-2 text-sm hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Schools List */}
                        <SummaryCard
                            title="Driving Schools"
                            description="All registered driving schools."
                            footer={loading ? 'Loading...' : `${schools.length} school(s)`}
                        >
                            <ul className="space-y-2 text-sm max-h-96 overflow-y-auto">
                                {schools.map((school) => (
                                    <li key={school.id} className="border rounded p-3 bg-slate-50">
                                        <div className="flex justify-between items-center">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-slate-900 truncate">{school.name}</p>
                                                <p className="text-xs text-slate-800">{school.contactEmail || 'No email'}</p>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded ml-2 whitespace-nowrap ${school.status === 'active' ? 'bg-green-100 text-green-800' : school.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                {school.status === 'active' ? 'Active' : school.status === 'suspended' ? 'Suspended' : 'Deleted'}
                                            </span>
                                        </div>
                                        {school.status !== 'deleted' && (
                                            <div className="flex gap-1 mt-2 pt-2 border-t border-slate-200">
                                                <button
                                                    onClick={() => openEdit(school)}
                                                    className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                                                >
                                                    Edit
                                                </button>
                                                {school.status === 'active' && (
                                                    <button
                                                        onClick={() => setConfirmAction({ schoolId: school.id, action: 'suspend', schoolName: school.name })}
                                                        className="text-xs px-2 py-1 rounded border border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                                                    >
                                                        Suspend
                                                    </button>
                                                )}
                                                {school.status === 'suspended' && (
                                                    <button
                                                        onClick={() => setConfirmAction({ schoolId: school.id, action: 'activate', schoolName: school.name })}
                                                        className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50"
                                                    >
                                                        Activate
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setConfirmAction({ schoolId: school.id, action: 'delete', schoolName: school.name })}
                                                    className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                                {schools.length === 0 && !loading && (
                                    <li className="text-xs text-slate-800 text-center py-4">No schools yet.</li>
                                )}
                            </ul>

                            <form className="mt-4 space-y-2" onSubmit={handleCreateSchool}>
                                <div className="text-xs font-medium text-slate-800">Create New School</div>
                                <input
                                    className="border rounded px-3 py-2 text-sm w-full text-slate-900"
                                    placeholder="School name *"
                                    value={schoolForm.name}
                                    onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                                    required
                                />
                                <input
                                    className="border rounded px-3 py-2 text-sm w-full text-slate-900"
                                    placeholder="Contact email (optional)"
                                    type="email"
                                    value={schoolForm.contactEmail}
                                    onChange={(e) => setSchoolForm({ ...schoolForm, contactEmail: e.target.value })}
                                />
                                <button
                                    type="submit"
                                    className="w-full bg-slate-900 text-white rounded px-3 py-2 text-sm hover:bg-slate-800"
                                >
                                    Create School
                                </button>
                            </form>
                        </SummaryCard>

                        {/* School Admins */}
                        <SummaryCard
                            title="School Administrators"
                            description="Invite admins to manage schools."
                            footer={`${admins.length} admin(s)`}
                        >
                            <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                                {admins.map((admin) => {
                                    const school = schools.find(s => s.id === admin.drivingSchoolId);
                                    return (
                                        <li key={admin.id} className="border rounded p-2 bg-blue-50">
                                            <p className="font-medium text-slate-900">{admin.email}</p>
                                            <p className="text-xs text-slate-800">
                                                {admin.fullName || 'No name'} &bull; {school?.name || 'Unknown school'}
                                            </p>
                                        </li>
                                    );
                                })}
                                {admins.length === 0 && (
                                    <li className="text-xs text-slate-800 text-center py-4">No school admins yet.</li>
                                )}
                            </ul>

                            <form className="mt-4 space-y-2" onSubmit={handleInviteAdmin}>
                                <div className="text-xs font-medium text-slate-800">Invite School Admin</div>
                                <select
                                    className="border rounded px-3 py-2 text-sm w-full text-slate-900"
                                    value={adminForm.schoolId}
                                    onChange={(e) => setAdminForm({ ...adminForm, schoolId: e.target.value })}
                                    required
                                >
                                    <option value="">Select school *</option>
                                    {schools.map((school) => (
                                        <option key={school.id} value={school.id}>{school.name}</option>
                                    ))}
                                </select>
                                <input
                                    className="border rounded px-3 py-2 text-sm w-full"
                                    placeholder="Admin email *"
                                    type="email"
                                    value={adminForm.email}
                                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                                    required
                                />
                                <input
                                    className="border rounded px-3 py-2 text-sm w-full"
                                    placeholder="Full name (optional)"
                                    value={adminForm.fullName}
                                    onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                                />
                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 text-white rounded px-3 py-2 text-sm hover:bg-blue-700"
                                >
                                    Send Invitation
                                </button>
                            </form>
                        </SummaryCard>
                    </div>

                    {/* System Status */}
                    <SummaryCard
                        title="System Status"
                        description="Server health and resource usage (auto-refreshes every 30s)."
                        footer={systemStatus ? `Node ${systemStatus.node}` : 'Loading...'}
                    >
                        {systemStatus ? (
                            <div className="space-y-4 text-sm">
                                {/* Database */}
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                                            systemStatus.database.status === 'ok'
                                                ? (systemStatus.database.latencyMs !== null && systemStatus.database.latencyMs < 200 ? 'bg-green-500' : 'bg-yellow-500')
                                                : 'bg-red-500'
                                        }`} />
                                        <span className="font-medium text-slate-900">Database</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                                            systemStatus.database.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {systemStatus.database.status}
                                        </span>
                                    </div>
                                    <div className="ml-4.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700 pl-1">
                                        <span>Latency</span>
                                        <span className="font-mono">{systemStatus.database.latencyMs !== null ? `${systemStatus.database.latencyMs}ms` : '—'}</span>
                                        <span>Pool (total / idle / waiting)</span>
                                        <span className="font-mono">{systemStatus.database.pool.total} / {systemStatus.database.pool.idle} / {systemStatus.database.pool.waiting}</span>
                                    </div>
                                </div>

                                {/* Server */}
                                <div>
                                    <p className="font-medium text-slate-900 mb-1">Server</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700 pl-1">
                                        <span>Uptime</span>
                                        <span className="font-mono">{systemStatus.uptime.formatted}</span>
                                        <span>Node.js</span>
                                        <span className="font-mono">{systemStatus.node}</span>
                                    </div>
                                </div>

                                {/* Memory */}
                                <div>
                                    <p className="font-medium text-slate-900 mb-1">Memory</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700 pl-1">
                                        <span>Heap Used / Total</span>
                                        <span className="font-mono">{systemStatus.memory.heapUsedMB} MB / {systemStatus.memory.heapTotalMB} MB</span>
                                        <span>RSS</span>
                                        <span className="font-mono">{systemStatus.memory.rssMB} MB</span>
                                    </div>
                                    {/* Heap usage bar */}
                                    <div className="mt-1.5 pl-1">
                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${
                                                    systemStatus.memory.heapUsedMB / systemStatus.memory.heapTotalMB > 0.85 ? 'bg-red-500' :
                                                    systemStatus.memory.heapUsedMB / systemStatus.memory.heapTotalMB > 0.7 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                                style={{ width: `${Math.round((systemStatus.memory.heapUsedMB / systemStatus.memory.heapTotalMB) * 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">{Math.round((systemStatus.memory.heapUsedMB / systemStatus.memory.heapTotalMB) * 100)}% heap used</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 py-4 text-center">
                                Unable to reach server
                            </div>
                        )}
                    </SummaryCard>
                </div>}
            </AppShell>
        </Protected>
    );
}
