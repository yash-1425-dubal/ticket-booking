'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Booking {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  bookingSeats: { seat: { seatNumber: string; category: string } }[];
  event: {
    startTime: string;
    movie: { id: string; title: string };
  };
  payment: { amount: number; status: string; paidAt: string };
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ success: boolean; data: Booking[] }>('/bookings')
      .then((res) => setBookings(res.data))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (error) return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-red-600">{error}</p></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Bookings</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No bookings yet.</p>
          <Link href="/movies" className="btn-primary">Browse Movies</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{booking.event?.movie?.title}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(booking.event?.startTime).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                  booking.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {booking.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {booking.bookingSeats?.map((bs, i) => (
                  <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {bs.seat?.seatNumber} ({bs.seat?.category})
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total: <strong>₹{Number(booking.totalAmount).toLocaleString('en-IN')}</strong></span>
                <div className="flex gap-2">
                  <Link href={`/bookings/${booking.id}`} className="btn-outline text-xs">View</Link>
                  {booking.status === 'CONFIRMED' && (
                    <Link href={`/bookings/${booking.id}/cancel`} className="btn-danger text-xs">Cancel</Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
