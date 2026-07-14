'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface WaitlistEntry {
  id: string;
  position: number;
  status: string;
  category: string;
  createdAt: string;
  event: {
    startTime: string;
    movie: { id: string; title: string };
  };
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWaitlist();
  }, []);

  const loadWaitlist = async () => {
    try {
      const res = await api.get<{ success: boolean; data: WaitlistEntry[] }>('/waitlist/my');
      setEntries(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelEntry = async (id: string) => {
    if (!confirm('Cancel this waitlist entry?')) return;
    try {
      await api.delete(`/waitlist/${id}`);
      loadWaitlist();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-8"><p className="text-red-600">{error}</p></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Waitlist</h1>

      {entries.length === 0 ? (
        <p className="text-gray-500">You are not on any waitlists.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">{entry.event?.movie?.title}</p>
                <p className="text-sm text-gray-600">
                  {entry.event ? new Date(entry.event.startTime).toLocaleDateString() : 'Unknown'} &middot; {entry.category}
                </p>
                <p className="text-xs text-gray-500">
                  Position: <span className="font-medium">{entry.position}</span> &middot; Status: <span className={`font-medium ${entry.status === 'PROMOTED' ? 'text-green-600' : entry.status === 'WAITING' ? 'text-yellow-600' : 'text-red-600'}`}>{entry.status}</span>
                </p>
              </div>
              {entry.status === 'WAITING' && (
                <button onClick={() => cancelEntry(entry.id)} className="btn-outline text-xs">Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
