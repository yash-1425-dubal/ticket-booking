'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import SeatMap from '@/components/SeatMap';
import { useSocket } from '@/lib/useSocket';

interface CastCrew {
  name: string;
  role: string;
  image_url?: string;
}

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
  heldSeats: number;
  bookedSeats: number;
  rows: Seat[][];
}

const ROWS = 8;
const COLS = 12;

const DIMENSION_MULTIPLIERS: Record<string, number> = {
  'IMAX 3D': 3.0,
  'IMAX 2D': 2.5,
  'DOLBY CINEMA 3D': 2.2,
  '4DX 3D': 2.2,
  '4DX': 2.2,
  'DOLBY CINEMA 2D': 1.8,
  'MX4D': 2.0,
  'EPIQ': 2.0,
  'ICE': 2.0,
  'PXL': 1.5,
  '3D': 1.3,
  '2D': 1.0,
};

const SORTED_DIMENSIONS = Object.entries(DIMENSION_MULTIPLIERS).sort(([a], [b]) => b.length - a.length);

const BASE_PRICES: Record<string, number> = {
  PREMIUM: 500,
  STANDARD: 300,
  ECONOMY: 180,
};

function generateMockSeats(): Seat[][] {
  const rows: Seat[][] = [];
  for (let r = 1; r <= ROWS; r++) {
    const row: Seat[] = [];
    for (let c = 1; c <= COLS; c++) {
      const rowLabel = String.fromCharCode(64 + r);
      const category = r <= 3 ? 'PREMIUM' : r <= 6 ? 'STANDARD' : 'ECONOMY';
      row.push({
        id: `${rowLabel}-${c}`,
        seatNumber: `${rowLabel}-${c}`,
        row: r,
        col: c,
        category,
        price: BASE_PRICES[category] || 200,
        status: 'AVAILABLE',
      });
    }
    rows.push(row);
  }
  return rows;
}

export default function ScraperMovieDetailPage() {
  const { eventCode } = useParams();
  const searchParams = useSearchParams();
  const city = searchParams.get('city') || '';
  const urlMode = searchParams.get('mode') || '';
  const router = useRouter();
  const { user } = useAuth();

  const [movie, setMovie] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDimension, setSelectedDimension] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [mockSeats] = useState<Seat[][]>(generateMockSeats);
  const autoImporting = useRef(false);

  // Booking flow state
  const [mode, setMode] = useState<'details' | 'seats'>('details');
  const [seatMap, setSeatMap] = useState<SeatMapData | null>(null);
  const [heldSeats, setHeldSeats] = useState<string[]>([]);
  const [holdExpiry, setHoldExpiry] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [holdExpiredAlert, setHoldExpiredAlert] = useState(false);
  const [booking, setBooking] = useState(false);
  const [holding, setHolding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [bookSuccess, setBookSuccess] = useState<any>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [joinWaitlistCategory, setJoinWaitlistCategory] = useState('PREMIUM');
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);

  // Real-time socket for seat updates
  const { onSeatEvent } = useSocket(eventId || undefined);

  useEffect(() => {
    if (!eventCode || !city) {
      setError(eventCode ? 'City parameter is required' : 'Invalid movie');
      setLoading(false);
      return;
    }
    fetchMovieDetails();
  }, [eventCode, city]);

  const fetchMovieDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: any }>(
        `/organizer/movie-details?city=${encodeURIComponent(city)}&event_code=${eventCode}`
      );
      const data = res.data?.data || res.data;
      if (data && data.status === 'error') {
        // Try sessionStorage fallback from listing page
        const cached = typeof window !== 'undefined' ? sessionStorage.getItem(`event:${eventCode}`) : null;
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.title || parsed.event_name) {
            setMovie(parsed);
            setLoading(false);
            return;
          }
        }
        // No usable fallback — skip import, show error
        setError('Event details unavailable. Please go back and try again.');
        setMovie(null);
        setLoading(false);
        return;
      }
      setMovie(data);
      if (data.event_dimension) {
        const dims = data.event_dimension.split(',').map((d: string) => d.trim());
        if (dims.length > 0) setSelectedDimension(dims[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load movie details');
    } finally {
      setLoading(false);
    }
  };

  const getPriceMultiplier = () => {
    const upper = selectedDimension.toUpperCase();
    for (const [key, val] of SORTED_DIMENSIONS) {
      if (upper.includes(key)) return val;
    }
    return 1.0;
  };

  const getSeatPrice = (category: string) => {
    const base = BASE_PRICES[category] || 200;
    return base * getPriceMultiplier();
  };

  const toggleSeat = useCallback((seatId: string) => {
    if (mode !== 'seats') return;
    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) return prev.filter((id) => id !== seatId);
      if (prev.length >= 10) return prev;
      return [...prev, seatId];
    });
  }, [mode]);

  // Hold countdown timer
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

  // Real-time socket updates for seat map
  useEffect(() => {
    if (!eventId) return;

    const unsubSeatHeld = onSeatEvent('seatHeld', (data: { eventId: string; seatIds: string[] }) => {
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

    const unsubSeatReleased = onSeatEvent('seatReleased', (data: { eventId: string; seatIds: string[] }) => {
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

    const unsubSeatBooked = onSeatEvent('seatBooked', (data: { eventId: string; seatIds: string[] }) => {
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

    const unsubWaitlistPromoted = onSeatEvent('waitlistPromoted', (data: { eventId: string; seatIds: string[]; expiresAt?: string }) => {
      if (data.eventId !== eventId) return;
      setHeldSeats((prev) => [...new Set([...prev, ...data.seatIds])]);
      setSelectedSeats((prev) => {
        const combined = [...new Set([...prev, ...data.seatIds])];
        return combined;
      });
      const expiry = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 15 * 60 * 1000);
      setHoldExpiry(expiry);
      setTimeLeft(Math.floor((expiry.getTime() - Date.now()) / 1000));
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

    return () => {
      unsubSeatHeld();
      unsubSeatReleased();
      unsubSeatBooked();
      unsubWaitlistPromoted();
    };
  }, [eventId, selectedSeats, heldSeats, onSeatEvent]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleBookNow = async () => {
    if (!user) {
      router.push(`/login?redirect=/movies/scraper/${eventCode}?city=${encodeURIComponent(city)}`);
      return;
    }
    if (!movie) return;
    setImporting(true);
    setError('');
    try {
      const res = await api.post<{ success: boolean; data: { movieId: string; eventId: string } }>(
        '/organizer/import-scraper-movie',
        {
          title: movie.event_name || movie.title,
          description: movie.description,
          posterUrl: movie.banner_image_url || movie.poster_url,
          category: movie.event_genre?.split('|')[0] || movie.genre?.split('|')[0] || 'General',
          language: movie.event_language?.[0] || (movie.language ? (Array.isArray(movie.language) ? movie.language[0] : movie.language) : ''),
          venueName: `${city} Multiplex`,
          venueCity: city,
          eventDate: movie.release_date || movie.event_date,
          eventCode: eventCode, // Pass eventCode for deduplication
        }
      );
      setEventId(res.data.eventId);

      // Fetch real seat map
      const seatsRes = await api.get<{ success: boolean; data: SeatMapData }>(
        `/events/${res.data.eventId}/seats`
      );
      setSeatMap(seatsRes.data);
      setMode('seats');
    } catch (err: any) {
      setError(err.message || 'Failed to set up booking');
    } finally {
      setImporting(false);
    }
  };

  // Auto-import when mode=seats (for events) — trigger after movie loads
  useEffect(() => {
    if (urlMode !== 'seats' || !movie || loading || autoImporting.current || eventId) return;
    autoImporting.current = true;
    if (!user) {
      router.push(`/login?redirect=/movies/scraper/${eventCode}?city=${encodeURIComponent(city)}&mode=seats`);
      return;
    }
    handleBookNow();
  }, [urlMode, movie, loading, user, eventId]);

  const handleHoldSeats = async () => {
    if (selectedSeats.length === 0 || !eventId) return;
    setHolding(true);
    setError('');
    try {
      const res = await api.post<{ success: boolean; data: { heldSeats: any[]; expiresAt: string } }>(
        `/events/${eventId}/seats/hold`,
        { seatIds: selectedSeats }
      );
      setHeldSeats(res.data.heldSeats.map((s: any) => s.id));
      setHoldExpiry(new Date(res.data.expiresAt));
      setTimeLeft(Math.floor((new Date(res.data.expiresAt).getTime() - Date.now()) / 1000));

      // Update seatMap locally since socket may not work (Redis unavailable)
      setSeatMap((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          heldSeats: prev.heldSeats + res.data.heldSeats.length,
          availableSeats: prev.availableSeats - res.data.heldSeats.length,
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
      setSelectedSeats([]);
      setHeldSeats([]);
      setHoldExpiry(null);
    } catch {}
  };

  const handleConfirmBooking = async () => {
    if (heldSeats.length === 0 || !eventId) return;
    setBooking(true);
    setError('');
    try {
      const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await api.post<{ success: boolean; data: any }>(
        `/bookings/${eventId}`,
        { seatIds: heldSeats },
        idempotencyKey
      );
      setBookSuccess(res.data);
      // Update seatMap locally to show BOOKED
      setSeatMap((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bookedSeats: prev.bookedSeats + heldSeats.length,
          heldSeats: prev.heldSeats - heldSeats.length,
          rows: prev.rows.map((row) =>
            row.map((seat) =>
              heldSeats.includes(seat.id) ? { ...seat, status: 'BOOKED' } : seat
            )
          ),
        };
      });
      // Load QR
      try {
        const qrRes = await api.get<{ success: boolean; data: { qrImage: string } }>(`/qr/${res.data.id}/qr`);
        setQrImage(qrRes.data.qrImage);
      } catch {}
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

  const filmStatus = () => {
    if (!movie) return null;
    const releaseDate = movie.release_date;
    if (!releaseDate) return null;
    const release = new Date(releaseDate);
    const now = new Date();
    const isUpcoming = release > now;
    const diffDays = Math.ceil((release.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      isUpcoming,
      label: isUpcoming ? `Releases in ${diffDays} day${diffDays === 1 ? '' : 's'}` : 'Now Showing',
      color: isUpcoming ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700',
      date: release.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    };
  };

  const status = filmStatus();
  const title = movie?.event_name || movie?.title || '';
  const posterUrl = movie?.banner_image_url || movie?.poster_url || '';
  const dimensions = movie?.event_dimension ? movie.event_dimension.split(',').map((d: string) => d.trim()) : [];
  const languages = movie?.event_language || [];
  const genres = movie?.event_genre ? movie.event_genre.split('|') : [];
  const rating = movie?.aggregated_rating;
  const multiplier = getPriceMultiplier();

  // Determine which seats to show in the seat map
  const activeRows = mode === 'seats' && seatMap
    ? seatMap.rows.map(row =>
        row.map(seat => ({
          ...seat,
          price: getSeatPrice(seat.category),
        }))
      )
    : mockSeats.map(row =>
        row.map(seat => ({
          ...seat,
          price: getSeatPrice(seat.category),
        }))
      );

  const activeSelectedSeats = mode === 'seats' && seatMap
    ? seatMap.rows.flat().filter((s) => selectedSeats.includes(s.id))
    : mockSeats.flat().filter((s) => selectedSeats.includes(s.id));

  const totalPrice = activeSelectedSeats.reduce((sum, s) => sum + getSeatPrice(s.category), 0);

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8"><p className="text-gray-500">Loading movie details...</p></div>;
  if (error && !movie) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <p className="text-red-600">{error}</p>
      <Link href="/movies" className="text-primary underline mt-4 inline-block">Back to Movies</Link>
    </div>
  );

  // Booking success view with QR
  if (bookSuccess) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="card max-w-md mx-auto">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600 mb-4">Your booking has been confirmed. Total: ₹{Number(bookSuccess.totalAmount).toLocaleString('en-IN')}</p>
          {qrImage && (
            <div className="bg-white p-4 rounded-lg border mb-4 inline-block">
              <img src={qrImage} alt="QR Ticket" className="w-48 h-48 mx-auto" />
              <p className="text-xs text-center text-gray-500 mt-2">Show this QR at the venue for entry</p>
            </div>
          )}
          <p className="text-sm text-gray-500 mb-4">A confirmation email has been sent to your email address.</p>
          <div className="flex gap-2 justify-center">
            <Link href={`/bookings/${bookSuccess.id}`} className="btn-primary">View Booking Details</Link>
            <Link href="/movies" className="btn-outline">Browse More</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/movies" className="text-sm text-primary hover:underline mb-4 inline-block">&larr; Back to Movies</Link>

      {/* Banner */}
      {posterUrl && (
        <div className="relative w-full h-64 md:h-96 rounded-xl overflow-hidden mb-8 bg-gray-100">
          <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-start gap-3">
              <h1 className="text-3xl md:text-4xl font-bold text-white">{title}</h1>
              {status && <span className={`text-sm px-3 py-1 rounded-full font-medium whitespace-nowrap ${status.color}`}>{status.label}</span>}
            </div>
            {movie.heading && <p className="text-white/80 mt-1">{movie.heading}</p>}
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2">
          {!posterUrl && (
            <div className="flex items-start gap-3 mb-4">
              <h1 className="text-3xl font-bold">{title}</h1>
              {status && <span className={`text-sm px-3 py-1 rounded-full font-medium whitespace-nowrap ${status.color}`}>{status.label}</span>}
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {genres.map((g) => (
              <span key={g} className="text-xs font-medium bg-primary-100 text-primary px-2 py-1 rounded">{g}</span>
            ))}
            {languages.map((l) => (
              <span key={l} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{l}</span>
            ))}
            {movie.event_censor && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{movie.event_censor}</span>}
            {movie.duration && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{movie.duration}</span>}
          </div>

          {/* Rating */}
          {rating !== undefined && rating !== null && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg font-bold text-amber-500">{rating}%</span>
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${rating}%` }} />
              </div>
              <span className="text-sm text-gray-500">Aggregated Rating</span>
            </div>
          )}

          {status && <p className="text-sm text-gray-500 mb-3">Release date: {status.date}</p>}
          {movie.description && <p className="text-gray-700 mb-4">{movie.description}</p>}

          {/* Dimension Selection */}
          {dimensions.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">Select Format</p>
              <div className="flex flex-wrap gap-2">
                {dimensions.map((dim) => {
                  const dimKey = dim.toUpperCase();
                  let mult = 1.0;
                  for (const [k, v] of SORTED_DIMENSIONS) {
                    if (dimKey.includes(k)) { mult = v; break; }
                  }
                  return (
                    <button
                      key={dim}
                      onClick={() => setSelectedDimension(dim)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        selectedDimension === dim
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-primary'
                      }`}
                    >
                      {dim} <span className="text-xs opacity-70">(&times;{mult.toFixed(1)})</span>
                    </button>
                  );
                })}
              </div>
              {selectedDimension && (
                <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  <p className="font-medium mb-1">Pricing for {selectedDimension}:</p>
                  <p>PREMIUM: ₹{Math.round(500 * multiplier).toLocaleString('en-IN')} &middot; STANDARD: ₹{Math.round(300 * multiplier).toLocaleString('en-IN')} &middot; ECONOMY: ₹{Math.round(180 * multiplier).toLocaleString('en-IN')}</p>
                </div>
              )}
            </div>
          )}

          {importing && (
            <div className="text-center py-6">
              <p className="text-gray-600">Importing movie and loading seats...</p>
            </div>
          )}

          {/* Seat Map */}
          {!importing && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">
                {mode === 'seats' ? 'Select Seats' : 'Seat Layout (Preview)'}
              </h2>

              {holdExpiredAlert && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg mb-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">Seat hold expired</p>
                    <p className="text-sm mt-1">The hold on your selected seats has expired. Select seats again to hold them.</p>
                  </div>
                  <button onClick={() => setHoldExpiredAlert(false)} className="text-orange-600 hover:text-orange-800 font-medium text-sm">Dismiss</button>
                </div>
              )}

              <div className="card">
                <SeatMap
                  rows={activeRows}
                  selectedSeats={selectedSeats}
                  heldSeats={heldSeats}
                  onToggleSeat={toggleSeat}
                  readOnly={mode !== 'seats'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right column — booking panel */}
        <div>
          {mode !== 'seats' && urlMode !== 'seats' ? (
            /* Summary & Book button (preview mode) — for regular movie detail pages */
            <div className="card sticky top-8">
              <h2 className="font-semibold text-lg mb-4">Your Selection</h2>
              <div className="text-sm text-gray-600 mb-4">
                <p>Format: <span className="font-medium">{selectedDimension || 'Not selected'}</span></p>
              </div>
              {selectedSeats.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">Seats:</h3>
                  <div className="space-y-1">
                    {activeSelectedSeats.map((s) => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span>{s.seatNumber} ({s.category})</span>
                        <span>₹{Math.round(getSeatPrice(s.category)).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="border-t pt-1 flex justify-between font-semibold mt-1">
                      <span>Total</span>
                      <span>₹{totalPrice.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}
              {selectedDimension && (
                <button onClick={handleBookNow} disabled={importing} className="btn-primary w-full">
                  {importing ? 'Importing...' : 'Proceed to Book'}
                </button>
              )}
            </div>
          ) : mode !== 'seats' ? (
            /* Loading state for events with mode=seats — hide format panel, show spinner */
            <div className="card sticky top-8">
              <h2 className="font-semibold text-lg mb-4">Loading seats...</h2>
              <p className="text-sm text-gray-600">Setting up event booking. Please wait a moment.</p>
            </div>
          ) : (
            /* Full booking panel (active booking mode) */
            <div className="card sticky top-8">
              <h2 className="font-semibold text-lg mb-4">Booking Details</h2>

              {holdExpiry && (
                <div className={`text-center p-3 rounded-lg mb-4 ${timeLeft < 120 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  <p className="text-sm font-medium">Hold expires in: {formatTime(timeLeft)}</p>
                </div>
              )}

              {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

              <div className="text-sm text-gray-600 mb-4">
                <p>Available: <span className="font-medium">{seatMap?.availableSeats || 0}</span></p>
                <p>Selected: <span className="font-medium">{selectedSeats.length}</span></p>
              </div>

              {activeSelectedSeats.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">Selected Seats:</h3>
                  <div className="space-y-1">
                    {activeSelectedSeats.map((s) => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span>{s.seatNumber} ({s.category})</span>
                        <span>₹{Math.round(getSeatPrice(s.category)).toLocaleString('en-IN')}</span>
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
                {heldSeats.length > 0 ? (
                  <>
                    <button onClick={handleConfirmBooking} disabled={booking} className="btn-primary w-full">
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
          )}
        </div>
      </div>

      {/* Cast */}
      {movie.cast && movie.cast.length > 0 && (
        <div className="mb-8 mt-8">
          <h2 className="text-xl font-semibold mb-4">Cast</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {movie.cast.map((person: CastCrew) => (
              <div key={person.name} className="flex flex-col items-center min-w-[100px]">
                <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden mb-2">
                  {person.image_url ? (
                    <img src={person.image_url} alt={person.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold">{person.name.charAt(0)}</div>
                  )}
                </div>
                <p className="text-sm font-medium text-center">{person.name}</p>
                <p className="text-xs text-gray-500 text-center">{person.role}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crew */}
      {movie.crew && movie.crew.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Crew</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {movie.crew.map((person: CastCrew) => (
              <div key={person.name} className="flex flex-col items-center min-w-[100px]">
                <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden mb-2">
                  {person.image_url ? (
                    <img src={person.image_url} alt={person.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold">{person.name.charAt(0)}</div>
                  )}
                </div>
                <p className="text-sm font-medium text-center">{person.name}</p>
                <p className="text-xs text-gray-500 text-center">{person.role}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
