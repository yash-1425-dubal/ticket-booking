'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface BookingDetail {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  bookingSeats: { seat: { seatNumber: string; row: number; col: number; category: string } }[];
  event: { startTime: string; endTime: string; movie: { id: string; title: string; venue: { name: string; address: string; city: string } } };
  payment: { amount: number; status: string; paidAt: string };
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBooking();
  }, [id]);

  const loadBooking = async () => {
    try {
      const res = await api.get<{ success: boolean; data: BookingDetail }>(`/bookings/${id}`);
      setBooking(res.data);
      // Load QR
      try {
        const qrRes = await api.get<{ success: boolean; data: { qrImage: string } }>(`/qr/${res.data.id}/qr`);
        setQrImage(qrRes.data.qrImage);
      } catch (err) {
        console.error(err);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (error) return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-red-600">{error}</p></div>;
  if (!booking) return <div className="max-w-4xl mx-auto px-4 py-8"><p>Booking not found</p></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">{booking.event?.movie?.title}</h1>
            <p className="text-gray-600">{booking.event?.movie?.venue?.name}, {booking.event?.movie?.venue?.city}</p>
            <p className="text-gray-600">
              {new Date(booking.event?.startTime).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
              {' at '}
              {new Date(booking.event?.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span className={`text-sm px-3 py-1 rounded font-medium ${
            booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
            booking.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {booking.status}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="font-semibold mb-3">Seats</h2>
            <div className="space-y-2">
              {booking.bookingSeats?.map((bs, i) => (
                <div key={i} className="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded">
                  <span>Seat {bs.seat?.seatNumber}</span>
                  <span className="text-gray-500">{bs.seat?.category}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t pt-4">
              <div className="flex justify-between font-semibold">
                <span>Total Paid</span>
                <span>₹{Number(booking.totalAmount).toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Paid on {new Date(booking.payment?.paidAt || booking.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-3">QR Ticket</h2>
            {qrImage ? (
              <div className="bg-white p-4 rounded-lg border">
                <img src={qrImage} alt="QR Ticket" className="w-48 h-48 mx-auto" />
                <p className="text-xs text-center text-gray-500 mt-2">Show this QR at the venue for entry</p>
              </div>
            ) : (
              <p className="text-gray-500">QR not available</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          {booking.status === 'CONFIRMED' && (
            <Link href={`/bookings/${id}/cancel`} className="btn-danger">Cancel Booking</Link>
          )}
          <Link href="/bookings" className="btn-outline">Back to Bookings</Link>
        </div>
      </div>
    </div>
  );
}
