'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function CancelBookingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/bookings/${id}/cancel`);
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">Booking Cancelled</h1>
        <p className="text-gray-600 mb-6">Your booking has been cancelled successfully.</p>
        <Link href="/bookings" className="btn-primary">Back to Bookings</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card text-center">
        <h1 className="text-2xl font-bold mb-4">Cancel Booking</h1>
        <p className="text-gray-600 mb-6">Are you sure you want to cancel this booking?</p>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <div className="flex gap-2 justify-center">
          <button onClick={handleCancel} disabled={loading} className="btn-danger">
            {loading ? 'Cancelling...' : 'Yes, Cancel Booking'}
          </button>
          <Link href={`/bookings/${id}`} className="btn-outline">Go Back</Link>
        </div>
      </div>
    </div>
  );
}
