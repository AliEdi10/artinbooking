'use client';

import React, { useEffect, useState } from 'react';
import { Protected } from '../auth/Protected';
import { AppShell } from '../components/AppShell';
import { SummaryCard } from '../components/SummaryCard';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../apiClient';

type DrivingSchool = {
    id: number;
    name: string;
    contactEmail: string | null;
    active: boolean;
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState('');

    const [schoolForm, setSchoolForm] = useState({ name: '', contactEmail: '' });
    const [adminForm, setAdminForm] = useState({ schoolId: '', email: '', fullName: '' });

    async function loadSchools() {
        if (!token) return;
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

    return (
        <Protected allowedRoles={['superadmin']}>
            <AppShell>
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Superadmin Dashboard</h1>
                        <p className="text-sm text-slate-700">
                            Manage driving schools and assign administrators.
                        </p>
                        {actionMessage && <p className="text-sm text-blue-700 mt-2">{actionMessage}</p>}
                        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Schools List */}
                        <SummaryCard
                            title="🏫 Driving Schools"
                            description="All registered driving schools."
                            footer={loading ? 'Loading...' : `${schools.length} school(s)`}
                        >
                            <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
                                {schools.map((school) => (
                                    <li key={school.id} className="border rounded p-3 bg-slate-50">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-medium text-slate-900">{school.name}</p>
                                                <p className="text-xs text-slate-700">{school.contactEmail || 'No email'}</p>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded ${school.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {school.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                                {schools.length === 0 && !loading && (
                                    <li className="text-xs text-slate-700 text-center py-4">No schools yet.</li>
                                )}
                            </ul>

                            <form className="mt-4 space-y-2" onSubmit={handleCreateSchool}>
                                <div className="text-xs font-medium text-slate-700">Create New School</div>
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
                            title="👤 School Administrators"
                            description="Invite admins to manage schools."
                            footer={`${admins.length} admin(s)`}
                        >
                            <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                                {admins.map((admin) => {
                                    const school = schools.find(s => s.id === admin.drivingSchoolId);
                                    return (
                                        <li key={admin.id} className="border rounded p-2 bg-blue-50">
                                            <p className="font-medium text-slate-900">{admin.email}</p>
                                            <p className="text-xs text-slate-700">
                                                {admin.fullName || 'No name'} • {school?.name || 'Unknown school'}
                                            </p>
                                        </li>
                                    );
                                })}
                                {admins.length === 0 && (
                                    <li className="text-xs text-slate-700 text-center py-4">No school admins yet.</li>
                                )}
                            </ul>

                            <form className="mt-4 space-y-2" onSubmit={handleInviteAdmin}>
                                <div className="text-xs font-medium text-slate-700">Invite School Admin</div>
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
                                    📧 Send Invitation
                                </button>
                            </form>
                        </SummaryCard>
                    </div>
                </div>
            </AppShell>
        </Protected>
    );
}
