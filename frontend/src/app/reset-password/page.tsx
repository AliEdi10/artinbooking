'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    // Password strength indicators
    const passwordChecks = {
        length: password.length >= 8,
        hasNumber: /\d/.test(password),
        hasLetter: /[a-zA-Z]/.test(password),
    };
    const isPasswordValid = passwordChecks.length && passwordChecks.hasNumber && passwordChecks.hasLetter;
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Invalid reset link. Please request a new password reset.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isPasswordValid) {
            setStatus('error');
            setMessage('Password does not meet requirements');
            return;
        }

        if (!passwordsMatch) {
            setStatus('error');
            setMessage('Passwords do not match');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            const response = await fetch(`${BACKEND_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }

            setStatus('success');
            setMessage(data.message);

            // Redirect to login after 3 seconds
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'Failed to reset password');
        }
    };

    if (!token) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow p-6 w-full max-w-md space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-red-600 text-xl">⚠️</span>
                        <div>
                            <h3 className="font-medium text-red-800">Invalid Reset Link</h3>
                            <p className="text-sm text-red-700 mt-1">
                                This password reset link is invalid or has expired.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2 text-center">
                    <Link
                        href="/login/forgot-password"
                        className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                        Request a new reset link
                    </Link>
                    <Link
                        href="/login"
                        className="text-sm text-slate-700 hover:text-slate-800"
                    >
                        ← Back to login
                    </Link>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow p-6 w-full max-w-md space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-green-600 text-xl">✅</span>
                        <div>
                            <h3 className="font-medium text-green-800">Password Reset Successful!</h3>
                            <p className="text-sm text-green-700 mt-1">{message}</p>
                            <p className="text-sm text-green-600 mt-2">Redirecting to login...</p>
                        </div>
                    </div>
                </div>
                <div className="text-center">
                    <Link
                        href="/login"
                        className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                        Go to login now →
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow p-6 w-full max-w-md space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
                <p className="text-sm text-slate-700">
                    Enter your new password below.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {status === 'error' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {message}
                    </div>
                )}

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                        New Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        disabled={status === 'loading'}
                        className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />

                    {/* Password strength indicators */}
                    <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                            <span className={passwordChecks.length ? 'text-green-600' : 'text-slate-400'}>
                                {passwordChecks.length ? '✓' : '○'}
                            </span>
                            <span className={passwordChecks.length ? 'text-green-700' : 'text-slate-500'}>
                                At least 8 characters
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className={passwordChecks.hasLetter ? 'text-green-600' : 'text-slate-400'}>
                                {passwordChecks.hasLetter ? '✓' : '○'}
                            </span>
                            <span className={passwordChecks.hasLetter ? 'text-green-700' : 'text-slate-500'}>
                                Contains a letter
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className={passwordChecks.hasNumber ? 'text-green-600' : 'text-slate-400'}>
                                {passwordChecks.hasNumber ? '✓' : '○'}
                            </span>
                            <span className={passwordChecks.hasNumber ? 'text-green-700' : 'text-slate-500'}>
                                Contains a number
                            </span>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                        Confirm Password
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        disabled={status === 'loading'}
                        className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                    {confirmPassword && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className={passwordsMatch ? 'text-green-600' : 'text-red-500'}>
                                {passwordsMatch ? '✓' : '✕'}
                            </span>
                            <span className={passwordsMatch ? 'text-green-700' : 'text-red-600'}>
                                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                            </span>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={status === 'loading' || !isPasswordValid || !passwordsMatch}
                    className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {status === 'loading' ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Resetting...
                        </span>
                    ) : (
                        'Reset Password'
                    )}
                </button>

                <div className="text-center pt-2">
                    <Link
                        href="/login"
                        className="text-sm text-slate-700 hover:text-slate-800"
                    >
                        ← Back to login
                    </Link>
                </div>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <Suspense fallback={
                <div className="bg-white border border-slate-200 rounded-lg shadow p-6 w-full max-w-md">
                    <div className="flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </div>
                </div>
            }>
                <ResetPasswordForm />
            </Suspense>
        </main>
    );
}
