'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface EventItem {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface MovieWithEvents {
  id: string;
  title: string;
  venue: { name: string };
  _count?: { events: number };
  events: EventItem[];
}

interface VenueOption {
  id: string;
  name: string;
}

export default function OrganizerEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN'))) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const [movies, setMovies] = useState<MovieWithEvents[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{ id: string; movieId: string; startTime: string; endTime: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ movieId: '', startDate: '', startTime: '', endDate: '', endTime: '' });
  const [seatPricing, setSeatPricing] = useState({ PREMIUM: '500', STANDARD: '300', ECONOMY: '180' });

  useEffect(() => {
    if (!authLoading) loadMovies();
  }, [authLoading]);

  const loadMovies = async () => {
    try {
      const res = await api.get<{ data: MovieWithEvents[] }>('/movies/mine');
      setMovies(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingEvent(null);
    setForm({ movieId: '', startDate: '', startTime: '', endDate: '', endTime: '' });
    setSeatPricing({ PREMIUM: '500', STANDARD: '300', ECONOMY: '180' });
    setShowForm(true);
  };

  const openEditForm = (event: EventItem, movieId: string) => {
    setEditingEvent({ id: event.id, movieId, startTime: event.startTime, endTime: event.endTime });
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    setForm({
      movieId,
      startDate: start.toISOString().slice(0, 10),
      startTime: start.toTimeString().slice(0, 5),
      endDate: end.toISOString().slice(0, 10),
      endTime: end.toTimeString().slice(0, 5),
    });
    setSeatPricing({ PREMIUM: '500', STANDARD: '300', ECONOMY: '180' });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setForm({ movieId: '', startDate: '', startTime: '', endDate: '', endTime: '' });
    setSeatPricing({ PREMIUM: '500', STANDARD: '300', ECONOMY: '180' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const startTime = new Date(`${form.startDate}T${form.startTime}`).toISOString();
      const endTime = new Date(`${form.endDate}T${form.endTime}`).toISOString();

      if (editingEvent) {
        await api.patch(`/events/${editingEvent.id}`, { startTime, endTime });
        setSuccess('Event updated');
      } else {
        await api.post('/events', {
          movieId: form.movieId,
          startTime,
          endTime,
          seatPricing: {
            PREMIUM: seatPricing.PREMIUM ? Number(seatPricing.PREMIUM) : undefined,
            STANDARD: seatPricing.STANDARD ? Number(seatPricing.STANDARD) : undefined,
            ECONOMY: seatPricing.ECONOMY ? Number(seatPricing.ECONOMY) : undefined,
          },
        });
        setSuccess('Event created successfully with seats!');
      }
      closeForm();
      loadMovies();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${eventId}`);
      setSuccess('Event deleted');
      loadMovies();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  if (authLoading) return <div className="max-w-5xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN')) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Events</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push('/organizer/movies')} className="btn-outline">Manage Movies</button>
          <button onClick={openCreateForm} className="btn-primary">Create Event</button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeForm}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editingEvent ? 'Edit Event' : 'New Event'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {editingEvent ? (
                <p className="text-sm text-gray-500">
                  Editing event for movie ID: {editingEvent.movieId}
                </p>
              ) : (
                <select
                  value={form.movieId}
                  onChange={(e) => setForm({ ...form, movieId: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select movie</option>
                  {movies.map((mov) => (
                    <option key={mov.id} value={mov.id}>{mov.title} ({mov.venue?.name})</option>
                  ))}
                </select>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Start Time</label>
                  <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="input-field" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="text-xs text-gray-500">End Time</label>
                  <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="input-field" required />
                </div>
              </div>

              {!editingEvent && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-2">Pricing per category <span className="text-gray-400 font-normal">(optional — defaults used if empty)</span></p>
                  <div className="space-y-2">
                    {(['PREMIUM', 'STANDARD', 'ECONOMY'] as const).map((cat) => (
                      <div key={cat} className="flex items-center gap-2">
                        <label className="w-24 text-gray-600 font-medium">{cat}</label>
                        <span className="text-gray-500">&#8377;</span>
                        <input
                          type="number"
                          min="1"
                          max="99999"
                          value={seatPricing[cat]}
                          onChange={(e) => setSeatPricing({ ...seatPricing, [cat]: e.target.value })}
                          className="input-field w-32"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Seats generated automatically from venue layout (PREMIUM rows 1-3, STANDARD rows 4-6, ECONOMY 7+)</p>
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">{editingEvent ? 'Save' : 'Create Event'}</button>
                <button type="button" onClick={closeForm} className="btn-outline flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <p>Loading...</p> : (
        <div className="space-y-6">
          {movies.length === 0 ? (
            <p className="text-gray-500">No movies found. <button onClick={() => router.push('/organizer/movies')} className="text-primary underline">Create a movie first</button></p>
          ) : (
            movies.filter(mov => mov.events?.length > 0).length === 0 ? (
              <p className="text-gray-500">No events created yet. Create an event for one of your movies.</p>
            ) : null
          )}
          {movies.filter(mov => mov.events?.length > 0).map((movie) => (
            <div key={movie.id}>
              <h3 className="font-semibold text-lg mb-2">{movie.title} <span className="text-sm text-gray-500 font-normal">({movie.venue?.name})</span></h3>
              <div className="space-y-2">
                {movie.events.map((event) => (
                  <div key={event.id} className="card flex items-center justify-between">
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">{formatDate(event.startTime)}</span>
                        {' '}{formatTime(event.startTime)} &ndash; {formatTime(event.endTime)}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded ${event.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' : event.status === 'ONGOING' ? 'bg-green-100 text-green-700' : event.status === 'COMPLETED' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>
                        {event.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEditForm(event, movie.id)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                      <button onClick={() => deleteEvent(event.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
