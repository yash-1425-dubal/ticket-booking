'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
          <p className="text-gray-600 mb-6">
            If an account exists for {email}, we&apos;ve sent a password reset link. Check your email and follow the instructions.
          </p>
          <Link href="/login" className="btn-primary inline-block">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-2">Forgot Password</h1>
        <p className="text-sm text-gray-600 text-center mb-6">Enter your email and we&apos;ll send you a reset link.</p>
        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          <Link href="/login" className="text-primary hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
