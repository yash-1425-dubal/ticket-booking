'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface DashboardData {
  eventsCount: number;
  totalBookings: number;
  totalRevenue: number;
  cancelledBookings: number;
  occupancyRate: number;
  availableSeats: number;
  waitlistCount: number;
  events: { id: string; title: string; status: string; category?: string; venue: { name: string }; _count: { events: number }; bookings: number; revenue: number; availableSeats: number; bookedSeats: number }[];
}

export default function OrganizerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN'))) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ success: boolean; data: DashboardData }>('/dashboard/organizer')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (authLoading) return <div className="max-w-6xl mx-auto px-4 py-8"><p>Loading dashboard...</p></div>;
  if (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN')) return null;

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8"><p>Loading dashboard...</p></div>;
  if (error) return <div className="max-w-6xl mx-auto px-4 py-8"><p className="text-red-600">{error}</p></div>;
  if (!data) return <div className="max-w-6xl mx-auto px-4 py-8"><p>Failed to load dashboard</p></div>;

  const movieItems = data.events.filter(m => m.category !== 'EVENTS');
  const eventItems = data.events.filter(m => m.category === 'EVENTS');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Organizer Dashboard</h1>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary">{data.totalBookings}</p>
          <p className="text-sm text-gray-600">Total Bookings</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">₹{Number(data.totalRevenue).toLocaleString('en-IN')}</p>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{data.occupancyRate}%</p>
          <p className="text-sm text-gray-600">Occupancy Rate</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-yellow-600">{data.waitlistCount}</p>
          <p className="text-sm text-gray-600">Waitlisted</p>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <Link href="/organizer/movies" className="card text-center flex-1 hover:shadow-md transition-shadow">
          <p className="font-semibold text-primary">Manage Movies</p>
        </Link>
        <Link href="/organizer/events" className="card text-center flex-1 hover:shadow-md transition-shadow">
          <p className="font-semibold text-primary">Manage Events</p>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="card">
          <h3 className="font-semibold mb-2">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Movies</span><span className="font-medium">{movieItems.length}</span></div>
            <div className="flex justify-between"><span>Events</span><span className="font-medium">{eventItems.length}</span></div>
            <div className="flex justify-between"><span>Cancelled Bookings</span><span className="font-medium">{data.cancelledBookings}</span></div>
            <div className="flex justify-between"><span>Available Seats</span><span className="font-medium">{data.availableSeats}</span></div>
          </div>
        </div>
      </div>

      {movieItems.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-4">Your Movies</h2>
          <div className="grid gap-4 mb-8">
            {movieItems.map((movie) => (
              <div key={movie.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{movie.title}</h3>
                    <p className="text-sm text-gray-600">{movie.venue?.name} &middot; {movie._count?.events} events</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${movie.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {movie.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm border-t pt-3 mt-2">
                  <div>
                    <p className="text-gray-500">Bookings</p>
                    <p className="font-semibold">{movie.bookings}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Revenue</p>
                    <p className="font-semibold text-green-600">₹{Number(movie.revenue).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Seats</p>
                    <p className="font-semibold">{movie.bookedSeats} / {movie.bookedSeats + movie.availableSeats} booked</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {eventItems.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-4">Your Events</h2>
          <div className="grid gap-4 mb-8">
            {eventItems.map((event) => (
              <div key={event.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{event.title}</h3>
                    <p className="text-sm text-gray-600">{event.venue?.name} &middot; {event._count?.events} events</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${event.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {event.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm border-t pt-3 mt-2">
                  <div>
                    <p className="text-gray-500">Bookings</p>
                    <p className="font-semibold">{event.bookings}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Revenue</p>
                    <p className="font-semibold text-green-600">₹{Number(event.revenue).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Seats</p>
                    <p className="font-semibold">{event.bookedSeats} / {event.bookedSeats + event.availableSeats} booked</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
