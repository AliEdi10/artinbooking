'use client';

import { useState } from 'react';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            setStatus('error');
            setMessage('Please enter your email address');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            const response = await fetch(`${BACKEND_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            setStatus('success');
            setMessage(data.message);
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'Failed to send reset email');
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="bg-white border border-slate-200 rounded-lg shadow p-6 w-full max-w-md space-y-6">
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
                    <p className="text-sm text-slate-600">
                        Enter your email address and we&apos;ll send you a link to reset your password.
                    </p>
                </div>

                {status === 'success' ? (
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <span className="text-green-600 text-xl">✉️</span>
                                <div>
                                    <h3 className="font-medium text-green-800">Check your email</h3>
                                    <p className="text-sm text-green-700 mt-1">{message}</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-center">
                            <Link
                                href="/login"
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                ← Back to login
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {status === 'error' && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                {message}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-800 mb-1">
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                disabled={status === 'loading'}
                                className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {status === 'loading' ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Sending...
                                </span>
                            ) : (
                                'Send Reset Link'
                            )}
                        </button>

                        <div className="text-center pt-2">
                            <Link
                                href="/login"
                                className="text-sm text-slate-600 hover:text-slate-800"
                            >
                                ← Back to login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </main>
    );
}
