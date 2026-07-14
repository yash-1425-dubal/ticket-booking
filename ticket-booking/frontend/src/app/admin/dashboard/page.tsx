'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface AdminData {
  users: any[];
  movies: any[];
  events: any[];
  venues: any[];
  bookings: any[];
  seats: any[];
  payments: any[];
  notifications: any[];
  scraperCache: any[];
  waitlistEntries: any[];
}

type Section = 'users' | 'movies' | 'events' | 'venues' | 'bookings' | 'seats' | 'payments' | 'notifications' | 'scraperCache' | 'waitlistEntries';

const SECTION_LABELS: Record<Section, string> = {
  users: 'Users',
  movies: 'Movies',
  events: 'Events',
  venues: 'Venues',
  bookings: 'Bookings',
  seats: 'Seats',
  payments: 'Payments',
  notifications: 'Notifications',
  scraperCache: 'Scraper Cache',
  waitlistEntries: 'Waitlist',
};

const SECTION_COLUMNS: Record<Section, string[]> = {
  users: ['id', 'name', 'email', 'role', 'isEmailVerified', 'createdAt'],
  movies: ['id', 'title', 'status', 'category', 'venueId', 'organizerId', 'createdAt'],
  events: ['id', 'movieId', 'startTime', 'endTime', 'status', 'createdAt'],
  venues: ['id', 'name', 'address', 'city', 'totalRows', 'seatsPerRow', 'createdAt'],
  bookings: ['id', 'userId', 'eventId', 'status', 'totalAmount', 'createdAt'],
  seats: ['id', 'eventId', 'seatNumber', 'row', 'col', 'category', 'price', 'status'],
  payments: ['id', 'bookingId', 'amount', 'method', 'status', 'paidAt'],
  notifications: ['id', 'userId', 'type', 'title', 'message', 'readAt', 'createdAt'],
  scraperCache: ['id', 'city', 'type', 'createdAt'],
  waitlistEntries: ['id', 'userId', 'eventId', 'category', 'position', 'status', 'createdAt'],
};

function DataTable({ rows, columns }: { rows: any[]; columns: string[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-400 py-2">No entries.</p>;
  return (
    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col} className="text-left px-2 py-1.5 border-b font-medium text-gray-600 whitespace-nowrap">
                {col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col} className="px-2 py-1 border-b text-gray-700 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(val: any): string {
  if (val === null || val === undefined) return '—';
  if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
    try { return new Date(val).toLocaleString(); } catch {}
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 60);
  return String(val);
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [configValue, setConfigValue] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configMsg, setConfigMsg] = useState('');
  const [configError, setConfigError] = useState('');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get<{ success: boolean; data: AdminData }>('/dashboard/admin')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get<{ success: boolean; data: Record<string, string> }>('/admin/config?key=PARSE_API_KEY')
      .then((res) => {
        if (res.data?.PARSE_API_KEY) setConfigValue(res.data.PARSE_API_KEY);
      })
      .catch(() => {});
  }, []);

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    setConfigMsg('');
    setConfigError('');
    try {
      await api.put('/admin/config', { key: 'PARSE_API_KEY', value: configValue });
      setConfigMsg('API key saved successfully!');
    } catch (err: any) {
      setConfigError(err.message);
    } finally {
      setConfigLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (authLoading) return <div className="max-w-7xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (!user || user.role !== 'ADMIN') return null;

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-4 py-8"><p className="text-red-600">{error}</p></div>;
  if (!data) return <div className="max-w-7xl mx-auto px-4 py-8"><p>Failed to load</p></div>;

  const sections: Section[] = ['users', 'movies', 'events', 'venues', 'bookings', 'seats', 'payments', 'notifications', 'scraperCache', 'waitlistEntries'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* System Configuration */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-3">System Configuration</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">Key</label>
            <input type="text" value="PARSE_API_KEY" readOnly className="input-field text-sm bg-gray-50" />
          </div>
          <div className="flex-[2] min-w-[250px]">
            <label className="text-xs text-gray-500 mb-1 block">Value</label>
            <input type="text" value={configValue} onChange={(e) => setConfigValue(e.target.value)} placeholder="Enter PARSE_API_KEY..." className="input-field text-sm font-mono" />
          </div>
          <button onClick={handleSaveConfig} disabled={configLoading || !configValue} className="btn-primary text-sm">
            {configLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
        {configMsg && <p className="text-green-600 text-xs mt-2">{configMsg}</p>}
        {configError && <p className="text-red-600 text-xs mt-2">{configError}</p>}
      </div>

      {/* Summary stat cards */}
      <div className="grid md:grid-cols-5 gap-4 mb-8">
        {sections.map((key) => (
          <div key={key} className="card text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => toggleSection(key)}>
            <p className="text-3xl font-bold text-primary">{data[key]?.length || 0}</p>
            <p className="text-sm text-gray-600">{SECTION_LABELS[key]}</p>
          </div>
        ))}
      </div>

      {/* Expandable data tables */}
      <div className="space-y-4">
        {sections.map((key) => (
          <div key={key} className="card overflow-hidden">
            <button onClick={() => toggleSection(key)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div>
                <h2 className="font-semibold text-base">{SECTION_LABELS[key]}</h2>
                <p className="text-xs text-gray-500">{data[key]?.length || 0} entries</p>
              </div>
              <span className="text-gray-400 text-lg">{expanded[key] ? '▲' : '▼'}</span>
            </button>
            {expanded[key] && (
              <div className="px-4 pb-4">
                <DataTable rows={data[key] || []} columns={SECTION_COLUMNS[key]} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}