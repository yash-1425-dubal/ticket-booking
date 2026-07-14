'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    api.post(`/auth/verify-email/${encodeURIComponent(token)}`)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified successfully!');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err.message || 'Verification failed. The link may be invalid or expired.');
      });
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-xl font-bold mb-2">Verifying your email...</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-bold mb-2">Email Verified!</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link href="/login" className="btn-primary">Go to Login</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-xl font-bold mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link href="/" className="btn-primary">Go Home</Link>
          </>
        )}
      </div>
    </div>
  );
}
