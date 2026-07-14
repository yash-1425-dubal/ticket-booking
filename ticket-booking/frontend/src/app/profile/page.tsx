'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    try {
      const body: any = {};
      if (name !== user?.name) body.name = name;
      if (email !== user?.email) body.email = email;
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      if (Object.keys(body).length === 0) {
        setError('Nothing to update');
        setSaving(false);
        return;
      }
      const res = await api.patch<{ success: boolean; data: any }>('/auth/me', body);
      setMessage('Profile updated successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="max-w-md mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">My Profile</h1>

        {message && <p className="text-green-600 text-sm mb-4 text-center">{message}</p>}
        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
            />
            {!user.isEmailVerified && (
              <p className="text-xs text-yellow-600 mt-1">
                Not verified.{' '}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={async () => {
                    try {
                      await api.post('/auth/resend-verification');
                      setMessage('Verification email sent!');
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                >
                  Resend verification
                </button>
              </p>
            )}
            {user.isEmailVerified && (
              <p className="text-xs text-green-600 mt-1">Verified</p>
            )}
          </div>

          <hr className="border-gray-200" />
          <p className="text-sm font-medium text-gray-700">Change Password (optional)</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field"
              minLength={6}
            />
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
