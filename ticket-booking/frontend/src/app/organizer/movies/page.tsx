'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface Movie {
  id: string;
  title: string;
  language?: string;
  posterUrl?: string;
  status: string;
  venueId?: string;
  venue: { name: string; city: string };
  _count?: { events: number };
}

interface VenueOption {
  id: string;
  name: string;
  city: string;
}

export default function OrganizerMoviesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN'))) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', language: '', venueId: '', posterUrl: '' });
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState('');

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading]);

  const loadData = async () => {
    try {
      const [movRes, venRes, cityRes] = await Promise.all([
        api.get<{ data: Movie[] }>('/movies/mine?category=MOVIES'),
        api.get<{ data: VenueOption[] }>('/venues'),
        api.get<{ data: string[] }>('/venues/cities'),
      ]);
      setMovies(movRes.data);
      setVenues(venRes.data);
      setCities(cityRes.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingMovie(null);
    setForm({ title: '', language: '', venueId: '', posterUrl: '' });
    setSelectedCity('');
    setShowForm(true);
  };

  const openEditForm = (movie: Movie) => {
    setEditingMovie(movie);
    // Find the matching venue from the venues list
    const venue = venues.find(
      (v) => v.name === movie.venue?.name && v.city === movie.venue?.city
    );
    const city = venue?.city || movie.venue?.city || '';
    setForm({
      title: movie.title || '',
      language: movie.language || '',
      venueId: venue?.id || movie.venueId || '',
      posterUrl: movie.posterUrl || '',
    });
    setSelectedCity(city);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingMovie(null);
    setForm({ title: '', language: '', venueId: '', posterUrl: '' });
    setSelectedCity('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMovie) {
        await api.patch(`/movies/${editingMovie.id}`, form);
      } else {
        await api.post('/movies', { ...form, status: 'PUBLISHED' });
      }
      closeForm();
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteMovie = async (id: string) => {
    if (!confirm('Delete this movie and all its events?')) return;
    try {
      await api.delete(`/movies/${id}`);
      setMovies(movies.filter(m => m.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (authLoading) return <div className="max-w-5xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN')) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Movies</h1>
        <div className="flex gap-2">
          <Link href="/organizer/events" className="btn-outline text-sm">Manage Events</Link>
          <button onClick={openCreateForm} className="btn-primary">Create Movie</button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeForm}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editingMovie ? 'Edit Movie' : 'New Movie'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-field"
                required
              />
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="input-field"
              >
                <option value="">Select language</option>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Japanese">Japanese</option>
                <option value="Korean">Korean</option>
                <option value="Chinese">Chinese</option>
                <option value="Arabic">Arabic</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Russian">Russian</option>
                <option value="Other">Other</option>
              </select>
              <select
                value={selectedCity}
                onChange={(e) => {
                  const city = e.target.value;
                  setSelectedCity(city);
                  const cityVenues = venues.filter((v) => v.city === city);
                  setForm({ ...form, venueId: cityVenues.length > 0 ? cityVenues[0].id : '' });
                }}
                className="input-field"
              >
                <option value="">Select city</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
              {selectedCity && venues.filter((v) => v.city === selectedCity).length > 0 && (
                <select
                  value={form.venueId}
                  onChange={(e) => setForm({ ...form, venueId: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select venue</option>
                  {venues
                    .filter((v) => v.city === selectedCity)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                </select>
              )}
              {selectedCity && venues.filter((v) => v.city === selectedCity).length === 0 && (
                <p className="text-sm text-red-500">No venues available in this city</p>
              )}
              <input
                placeholder="Poster URL"
                value={form.posterUrl}
                onChange={(e) => setForm({ ...form, posterUrl: e.target.value })}
                className="input-field"
              />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingMovie ? 'Save' : 'Create'}
                </button>
                <button type="button" onClick={closeForm} className="btn-outline flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <p>Loading...</p> : movies.length === 0 ? (
        <p className="text-gray-500">No movies created yet.</p>
      ) : (
        <div className="grid gap-4">
          {movies.map((movie) => (
            <div key={movie.id} className="card flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{movie.title}</h3>
                <p className="text-sm text-gray-600">
                  {movie.venue?.name} ({movie.venue?.city}) &middot;{' '}
                  {movie._count?.events || 0} events
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    movie.status === 'PUBLISHED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {movie.status}
                </span>
                <button
                  onClick={() => openEditForm(movie)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteMovie(movie.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
