'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get<{ success: boolean; data: User[] }>('/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (userId: string, role: string) => {
    setError('');
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Delete this user?')) return;
    setError('');
    try {
      await api.delete(`/admin/users/${userId}`);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (authLoading) return <div className="max-w-5xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (!user || user.role !== 'ADMIN') return null;

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-8"><p>Loading...</p></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {users.length === 0 ? (
        <p className="text-gray-500">No users found.</p>
      ) : (
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 pr-4">Name</th>
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Role</th>
              <th className="pb-3 pr-4">Verified</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="py-3 pr-4">{user.name}</td>
                <td className="py-3 pr-4 text-gray-600">{user.email}</td>
                <td className="py-3 pr-4">
                  <select
                    value={user.role}
                    onChange={(e) => changeRole(user.id, e.target.value)}
                    className="text-xs border rounded px-1 py-0.5"
                    disabled={user.role === 'ADMIN'}
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="ORGANIZER">Organizer</option>
                  </select>
                </td>
                <td className="py-3 pr-4">
                  {user.isEmailVerified ? <span className="text-green-600 text-xs">Yes</span> : <span className="text-red-600 text-xs">No</span>}
                </td>
                <td className="py-3">
                  {user.role !== 'ADMIN' && (
                    <button onClick={() => deleteUser(user.id)} className="text-red-600 text-xs hover:underline">Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
