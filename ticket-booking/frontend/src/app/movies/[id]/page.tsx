'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Event {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  _count?: { seats: number; bookings: number };
}

interface Movie {
  id: string;
  title: string;
  description: string;
  category: string;
  venue: { name: string; address: string; city: string; totalRows: number; seatsPerRow: number };
  organizer: { id: string; name: string };
  events: Event[];
}

export default function MovieDetailPage() {
  const { id } = useParams();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ success: boolean; data: Movie }>(`/movies/${id}`)
      .then((res) => setMovie(res.data))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (error) return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-red-600">{error}</p></div>;
  if (!movie) return <div className="max-w-4xl mx-auto px-4 py-8"><p>Movie not found</p></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="card mb-6">
        <h1 className="text-3xl font-bold mb-2">{movie.title}</h1>
        <span className="text-sm bg-primary-100 text-primary px-2 py-1 rounded">{movie.category || 'General'}</span>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Venue</p>
            <p className="font-medium">{movie.venue?.name}</p>
            <p className="text-gray-600">{movie.venue?.address}, {movie.venue?.city}</p>
          </div>
          <div>
            <p className="text-gray-500">Capacity</p>
            <p className="font-medium">{movie.venue?.totalRows} rows &times; {movie.venue?.seatsPerRow} seats</p>
          </div>
        </div>

        <p className="mt-4 text-gray-700">{movie.description}</p>
      </div>

      <h2 className="text-xl font-semibold mb-4">Available Events</h2>
      {movie.events.length === 0 ? (
        <p className="text-gray-500">No events available.</p>
      ) : (
        <div className="grid gap-4">
          {movie.events
            .filter((e) => e.status === 'SCHEDULED')
            .map((event) => (
              <div key={event.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {new Date(event.startTime).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <Link
                  href={`/movies/${movie.id}/book?eventId=${event.id}`}
                  className="btn-primary"
                >
                  Select Seats
                </Link>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
