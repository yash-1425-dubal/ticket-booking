'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import SeatMap from '@/components/SeatMap';
import Link from 'next/link';
import { io } from 'socket.io-client';

interface Seat {
  id: string;
  seatNumber: string;
  row: number;
  col: number;
  category: string;
  price: number;
  status: string;
}

interface SeatMapData {
  event: any;
  totalSeats: number;
  availableSeats: number;
  rows: Seat[][];
}

function BookingSuccessView({ booking, qrImage, totalAmount }: { booking: any; qrImage?: string; totalAmount: number }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-center">
      <div className="card max-w-md mx-auto">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
        <p className="text-gray-600 mb-4">Your booking has been confirmed. Total: ₹{Number(totalAmount).toLocaleString('en-IN')}</p>
        {qrImage && (
          <div className="bg-white p-4 rounded-lg border mb-4 inline-block">
            <img src={qrImage} alt="QR Ticket" className="w-48 h-48 mx-auto" />
            <p className="text-xs text-center text-gray-500 mt-2">Show this QR at the venue for entry</p>
          </div>
        )}
        <p className="text-sm text-gray-500 mb-4">A confirmation email with QR has been sent to your email address.</p>
        <div className="flex gap-2 justify-center">
          <Link href={`/bookings/${booking.id}`} className="btn-primary">View Booking Details</Link>
          <Link href="/movies" className="btn-outline">Browse More</Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  const { id: movieId } = useParams();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const router = useRouter();
  const { user } = useAuth();

  const [seatMap, setSeatMap] = useState<SeatMapData | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [heldSeats, setHeldSeats] = useState<string[]>([]);
  const [holdExpiry, setHoldExpiry] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState('');
  const [successBooking, setSuccessBooking] = useState<any>(null);
  const [waitlistPromotion, setWaitlistPromotion] = useState<{ eventId: string; seatIds: string[] } | null>(null);
  const [holdExpiredAlert, setHoldExpiredAlert] = useState(false);
  const [joinWaitlistCategory, setJoinWaitlistCategory] = useState('PREMIUM');
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);

  useEffect(() => {
    if (eventId) {
      api.get<{ success: boolean; data: SeatMapData }>(`/events/${eventId}/seats`)
        .then((res) => setSeatMap(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [eventId]);

  // Real-time socket updates for seat map
  useEffect(() => {
    if (!eventId) return;

    const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      socket.emit('join-event', eventId);
    });

    socket.on('seatHeld', (data: { eventId: string; seatIds: string[] }) => {
      if (data.eventId !== eventId) return;
      setSeatMap((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((row) =>
            row.map((seat) =>
              data.seatIds.includes(seat.id) ? { ...seat, status: 'HELD' } : seat
            )
          ),
        };
      });
    });

    socket.on('seatReleased', (data: { eventId: string; seatIds: string[] }) => {
      if (data.eventId !== eventId) return;
      setSeatMap((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((row) =>
            row.map((seat) =>
              data.seatIds.includes(seat.id) ? { ...seat, status: 'AVAILABLE' } : seat
            )
          ),
        };
      });
    });

    socket.on('waitlistPromoted', (data: { eventId: string; seatIds: string[]; expiresAt?: string }) => {
      if (data.eventId !== eventId) return;
      setWaitlistPromotion(data);
      setHeldSeats((prev) => [...new Set([...prev, ...data.seatIds])]);
      setSelectedSeats((prev) => {
        const combined = [...new Set([...prev, ...data.seatIds])];
        return combined;
      });
      const expiry = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 15 * 60 * 1000);
      setHoldExpiry(expiry);
      setTimeLeft(Math.floor((expiry.getTime() - Date.now()) / 1000));
    });

    socket.on('seatBooked', (data: { eventId: string; seatIds: string[] }) => {
      if (data.eventId !== eventId) return;
      const hadSelected = data.seatIds.some((id) => selectedSeats.includes(id));
      const hadHeld = data.seatIds.some((id) => heldSeats.includes(id));
      setHeldSeats((h) => {
        const remaining = h.filter((id) => !data.seatIds.includes(id));
        if (remaining.length === 0 && h.length > 0) {
          setHoldExpiry(null);
          setTimeLeft(0);
          setSelectedSeats([]);
        }
        return remaining;
      });
      setSelectedSeats((s) => s.filter((id) => !data.seatIds.includes(id)));
      setSeatMap((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((row) =>
            row.map((seat) =>
              data.seatIds.includes(seat.id) ? { ...seat, status: 'BOOKED' } : seat
            )
          ),
        };
      });
    });

    return () => {
      socket.emit('leave-event', eventId);
      socket.disconnect();
    };
  }, [eventId]);

  // Countdown timer for hold
  useEffect(() => {
    if (!holdExpiry) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((holdExpiry.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setSelectedSeats([]);
        setHeldSeats([]);
        setHoldExpiry(null);
        setHoldExpiredAlert(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [holdExpiry]);

  const toggleSeat = useCallback((seatId: string) => {
    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) {
        return prev.filter((id) => id !== seatId);
      }
      if (prev.length >= 10) return prev;
      return [...prev, seatId];
    });
  }, []);

  const handleHoldSeats = async () => {
    if (selectedSeats.length === 0 || !eventId) return;
    setError('');
    setHolding(true);
    try {
      const res = await api.post<{ success: boolean; data: { heldSeats: any[]; expiresAt: string } }>(
        `/events/${eventId}/seats/hold`,
        { seatIds: selectedSeats }
      );
      setHeldSeats(res.data.heldSeats.map((s) => s.id));
      setHoldExpiry(new Date(res.data.expiresAt));
      setTimeLeft(Math.floor((new Date(res.data.expiresAt).getTime() - Date.now()) / 1000));
      // Update seatMap locally since socket events may not fire
      setSeatMap((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((row) =>
            row.map((seat) =>
              selectedSeats.includes(seat.id) ? { ...seat, status: 'HELD' } : seat
            )
          ),
        };
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setHolding(false);
    }
  };

  const handleReleaseSeats = async () => {
    if (heldSeats.length === 0 || !eventId) return;
    try {
      await api.post(`/events/${eventId}/seats/release`, { seatIds: heldSeats });
      setSeatMap((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((row) =>
            row.map((seat) =>
              heldSeats.includes(seat.id) ? { ...seat, status: 'AVAILABLE' } : seat
            )
          ),
        };
      });
      setSelectedSeats([]);
      setHeldSeats([]);
      setHoldExpiry(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBook = async () => {
    if (heldSeats.length === 0 || !eventId) return;
    setBooking(true);
    setError('');
    try {
      const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await api.post<{ success: boolean; data: { booking: any; qrImage?: string } }>(
        `/bookings/${eventId}`,
        { seatIds: heldSeats },
        idempotencyKey
      );
      setSuccessBooking({ booking: res.data.booking, qrImage: res.data.qrImage, totalAmount: res.data.booking.totalAmount });
      // Update seatMap locally to show BOOKED immediately
      setSeatMap((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((row) =>
            row.map((seat) =>
              heldSeats.includes(seat.id) ? { ...seat, status: 'BOOKED' } : seat
            )
          ),
        };
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!eventId) return;
    setError('');
    setJoiningWaitlist(true);
    try {
      await api.post('/waitlist/join', { eventId, category: joinWaitlistCategory });
      setWaitlistJoined(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectedSeatDetails = seatMap?.rows
    ?.flat()
    .filter((s) => selectedSeats.includes(s.id)) || [];

  const totalPrice = selectedSeatDetails.reduce((sum, s) => sum + Number(s.price), 0);

  if (!eventId) {
    return <div className="max-w-4xl mx-auto px-4 py-8"><p>No event selected. <Link href="/movies" className="text-primary">Browse movies</Link></p></div>;
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><p>Loading seat map...</p></div>;
  if (!seatMap) return <div className="max-w-4xl mx-auto px-4 py-8"><p>Event not found</p></div>;

  if (successBooking) {
    const booking = successBooking.booking || successBooking;
    return <BookingSuccessView booking={booking} qrImage={successBooking.qrImage} totalAmount={successBooking.totalAmount || booking.totalAmount} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Seat Map */}
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold mb-2">{seatMap.event?.movie?.title}</h1>

          {waitlistPromotion && (
            <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-4 flex justify-between items-center">
              <div>
                <p className="font-medium">Great news — seats are now available for you!</p>
                <p className="text-sm mt-1">You've been promoted from the waitlist. Select and hold your seats to book them.</p>
              </div>
              <button
                onClick={() => setWaitlistPromotion(null)}
                className="text-green-600 hover:text-green-800 font-medium text-sm"
              >
                Dismiss
              </button>
            </div>
          )}

          {holdExpiredAlert && (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg mb-4 flex justify-between items-center">
              <div>
                <p className="font-medium">Seat hold expired</p>
                <p className="text-sm mt-1">The hold on your selected seats has expired. Select seats again to hold them.</p>
              </div>
              <button
                onClick={() => setHoldExpiredAlert(false)}
                className="text-orange-600 hover:text-orange-800 font-medium text-sm"
              >
                Dismiss
              </button>
            </div>
          )}

          <p className="text-gray-600 mb-4">
            {seatMap.event?.movie?.venue?.name} &middot; {new Date(seatMap.event?.startTime).toLocaleDateString()} &middot; {new Date(seatMap.event?.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="card">
            <SeatMap
              rows={seatMap.rows}
              selectedSeats={selectedSeats}
              heldSeats={heldSeats}
              onToggleSeat={toggleSeat}
            />
          </div>
        </div>

        {/* Booking Panel */}
        <div>
          <div className="card sticky top-8">
            <h2 className="font-semibold text-lg mb-4">Booking Details</h2>

            <div className="text-sm text-gray-600 mb-4">
              <p>Available: <span className="font-medium">{seatMap.availableSeats}</span></p>
              <p>Selected: <span className="font-medium">{selectedSeats.length}</span></p>
            </div>

            {holdExpiry && (
              <div className={`text-center p-3 rounded-lg mb-4 ${timeLeft < 120 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                <p className="text-sm font-medium">Hold expires in: {formatTime(timeLeft)}</p>
              </div>
            )}

            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

            {selectedSeatDetails.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Selected Seats:</h3>
                <div className="space-y-1">
                  {selectedSeatDetails.map((s) => (
                    <div key={s.id} className="flex justify-between text-sm">
                      <span>{s.seatNumber} ({s.category})</span>
                      <span>₹{Number(s.price).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="border-t pt-1 flex justify-between font-semibold mt-1">
                    <span>Total</span>
                    <span>₹{totalPrice.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {!user ? (
                <Link href="/login" className="btn-primary block text-center">Login to Book</Link>
              ) : heldSeats.length > 0 ? (
                <>
                  <button onClick={handleBook} disabled={booking} className="btn-primary w-full">
                    {booking ? 'Booking...' : `Confirm Booking - ₹${totalPrice.toLocaleString('en-IN')}`}
                  </button>
                  <button onClick={handleReleaseSeats} className="btn-outline w-full">Release Seats</button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleHoldSeats}
                    disabled={selectedSeats.length === 0 || holding}
                    className="btn-primary w-full"
                  >
                    {holding ? 'Holding...' : `Hold Selections (${selectedSeats.length})`}
                  </button>

                  <hr className="border-gray-200" />

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">No seats available?</p>
                    {waitlistJoined ? (
                      <p className="text-sm text-green-600">You're on the waitlist! Check your notifications for updates.</p>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={joinWaitlistCategory}
                          onChange={(e) => setJoinWaitlistCategory(e.target.value)}
                          className="input-field text-sm flex-1"
                        >
                          <option value="PREMIUM">Premium</option>
                          <option value="STANDARD">Standard</option>
                          <option value="ECONOMY">Economy</option>
                        </select>
                        <button
                          onClick={handleJoinWaitlist}
                          disabled={joiningWaitlist}
                          className="btn-outline text-sm"
                        >
                          {joiningWaitlist ? 'Joining...' : 'Join Waitlist'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
