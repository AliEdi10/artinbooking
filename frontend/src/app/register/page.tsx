'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '../apiClient';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

type InvitationInfo = {
    email: string;
    role: string;
    schoolName: string;
    fullName?: string;
    expiresAt: string;
};

function RegisterContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const [form, setForm] = useState({
        email: '',
        fullName: '',
        password: '',
        confirmPassword: '',
    });

    useEffect(() => {
        if (!token) {
            setError('No invitation token provided. Please use the link from your invitation email.');
            setLoading(false);
            return;
        }

        // Validate token and get invitation info
        async function validateToken() {
            try {
                const response = await fetch(`${BACKEND_URL}/invitations/validate?token=${token}`);
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Invalid or expired invitation');
                }
                const data = await response.json();
                setInvitationInfo(data);
                setForm((prev) => ({ ...prev, fullName: data.fullName || '' }));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to validate invitation');
            } finally {
                setLoading(false);
            }
        }

        validateToken();
    }, [token]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (form.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const endpoint = token
                ? `${BACKEND_URL}/invitations/accept`
                : `${BACKEND_URL}/auth/register`;

            const body = token
                ? { token, fullName: form.fullName, password: form.password }
                : {
                    email: form.email,
                    password: form.password,
                    fullName: form.fullName,
                    role: 'STUDENT',
                    drivingSchoolId: 100
                };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to complete registration');
            }

            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Validating...</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">✓</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Registration Complete!</h1>
                    <p className="text-slate-600 mb-4">
                        Your account has been created successfully. Redirecting to login...
                    </p>
                    <div className="animate-pulse text-sm text-slate-500">
                        You can now sign in with your email and password.
                    </div>
                </div>
            </div>
        );
    }

    if (error && token && !invitationInfo) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">✗</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Invalid Invitation</h1>
                    <p className="text-red-600 mb-4">{error}</p>
                    <a
                        href="/login"
                        className="inline-block px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                    >
                        Go to Login
                    </a>
                </div>
            </div>
        );
    }

    const isPublic = !token;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">
                        {isPublic ? 'Create Student Account' : 'Complete Your Registration'}
                    </h1>
                    {invitationInfo && (
                        <p className="text-slate-600 text-sm">
                            You've been invited to join <strong>{invitationInfo.schoolName}</strong>
                        </p>
                    )}
                    {isPublic && (
                        <p className="text-slate-600 text-sm">
                            Join Brightside Driving School
                        </p>
                    )}
                </div>

                {invitationInfo && (
                    <div className="bg-blue-50 rounded-lg p-4 mb-6">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-slate-500">Email:</span>
                                <p className="font-medium">{invitationInfo.email}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Role:</span>
                                <p className="font-medium capitalize">{invitationInfo.role.toLowerCase()}</p>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isPublic && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                            <input
                                type="email"
                                className="w-full border rounded-lg px-4 py-2"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            className="w-full border rounded-lg px-4 py-2"
                            value={form.fullName}
                            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            className={`w-full border rounded-lg px-4 py-2 ${form.password.length > 0 && form.password.length < 8 ? 'border-red-300 focus:border-red-500' : form.password.length >= 8 ? 'border-green-300 focus:border-green-500' : ''}`}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="At least 8 characters"
                            required
                            minLength={8}
                        />
                        {/* Password Strength Indicator */}
                        {form.password.length > 0 && (
                            <div className="mt-2">
                                <div className="flex gap-1 mb-1">
                                    {[1, 2, 3, 4].map((level) => (
                                        <div
                                            key={level}
                                            className={`h-1 flex-1 rounded ${form.password.length >= level * 3
                                                ? level <= 2 ? 'bg-red-400' : level === 3 ? 'bg-yellow-400' : 'bg-green-500'
                                                : 'bg-slate-200'
                                                }`}
                                        />
                                    ))}
                                </div>
                                <p className={`text-xs ${form.password.length < 8 ? 'text-red-600' : 'text-green-600'}`}>
                                    {form.password.length < 8
                                        ? `⚠️ ${8 - form.password.length} more character${8 - form.password.length > 1 ? 's' : ''} needed`
                                        : '✓ Password meets requirements'}
                                </p>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                        <input
                            type="password"
                            className={`w-full border rounded-lg px-4 py-2 ${form.confirmPassword.length > 0 ? (form.password === form.confirmPassword ? 'border-green-300' : 'border-red-300') : ''}`}
                            value={form.confirmPassword}
                            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                            required
                        />
                        {form.confirmPassword.length > 0 && (
                            <p className={`text-xs mt-1 ${form.password === form.confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                                {form.password === form.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Creating Account...' : 'Complete Registration'}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-500 mt-4">
                    Already have an account?{' '}
                    <a href="/login" className="text-blue-600 hover:underline">
                        Sign in
                    </a>
                </p>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        }>
            <RegisterContent />
        </Suspense>
    );
}
