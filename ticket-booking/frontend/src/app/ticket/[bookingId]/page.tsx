'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

interface TicketData {
  valid: boolean;
  booking: { id: string; status: string; totalAmount: number; createdAt: string };
  event: { title: string; venue: string; startTime: string };
  user: { name: string };
  seats: { seatNumber: string; category: string; price: number }[];
}

export default function TicketPage() {
  const { bookingId } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId || !token) {
      setError('Invalid ticket link');
      setLoading(false);
      return;
    }

    api.get<{ success: boolean; data: TicketData }>(`/qr/${bookingId}/verify?token=${encodeURIComponent(token)}`)
      .then((res) => setTicket(res.data))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Verifying ticket...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card max-w-md w-full mx-4 text-center">
        <div className="text-4xl mb-4">&#10060;</div>
        <h1 className="text-xl font-bold text-red-600 mb-2">Invalid Ticket</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    </div>
  );

  if (!ticket) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">&#10003;</div>
          <h1 className="text-2xl font-bold text-green-600">Valid Ticket</h1>
          <p className="text-gray-500 text-sm">Verified entry pass</p>
        </div>

        <div className="border-t border-b py-4 mb-4 space-y-3">
          <div className="text-center">
            <h2 className="text-xl font-bold">{ticket.event.title}</h2>
            <p className="text-gray-600">{ticket.event.venue}</p>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">
              {new Date(ticket.event.startTime).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Time</span>
            <span className="font-medium">
              {new Date(ticket.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Attendee</span>
            <span className="font-medium">{ticket.user.name}</span>
          </div>
        </div>

        <h3 className="font-semibold mb-2">Seats</h3>
        <div className="space-y-2">
          {ticket.seats.map((seat, i) => (
            <div key={i} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded text-sm">
              <div>
                <span className="font-medium">{seat.seatNumber}</span>
                <span className="text-gray-500 ml-2">{seat.category}</span>
              </div>
              <span>₹{seat.price.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t flex justify-between font-semibold">
          <span>Total</span>
          <span>₹{Number(ticket.booking.totalAmount).toLocaleString('en-IN')}</span>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Booking #{ticket.booking.id.slice(0, 8)}
        </p>
      </div>
    </div>
  );
}
