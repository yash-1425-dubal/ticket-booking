'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Movie {
  id: string;
  title: string;
  description?: string;
  category?: string;
  venue?: { name?: string; city?: string };
  status?: string;
  [key: string]: any;
}

const CATEGORIES = ['MOVIES', 'EVENTS'];


export default function MoviesPage() {
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [category, setCategory] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [geoCity, setGeoCity] = useState('');
  const [error, setError] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);

  const filteredCities = cities.filter(c =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Load available cities from venues
  useEffect(() => {
    api.get<{ data: string[] }>('/venues/cities').then(r => {
      if (r.data) setCities(r.data);
    }).catch(() => {});
  }, []);

  // Geolocation detection
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const data = await res.json();
          const addr = data?.address || {};
          const raw = addr.city_district || addr.county || addr.state_district || addr.city || addr.town || addr.state || '';
          let detected = raw;
          let prev;
          do {
            prev = detected;
            detected = detected.replace(/\s+(City|Subdistrict|Urban|Rural|District|Municipal\s*(Corporation|Council)?|Municipality|Division|Zone)\s*$/i, '').trim();
          } while (detected !== prev);
          if (detected) setGeoCity(detected);
        } catch {}
      },
      () => {},
      { timeout: 5000 }
    );
  }, []);

  // Auto-select detected city once cities are loaded
  useEffect(() => {
    if (geoCity && cities.length > 0 && !selectedCity) {
      const geoLower = geoCity.toLowerCase();
      const match = cities.find(c => {
        const cLower = c.toLowerCase();
        return cLower === geoLower || geoLower.includes(cLower) || cLower.includes(geoLower);
      });
      if (match) setSelectedCity(match);
    }
  }, [geoCity, cities, selectedCity]);

  // Fetch movies when city or category changes
  useEffect(() => {
    fetchMovies();
  }, [selectedCity, category]);

  const fetchMovies = async () => {
    setLoading(true);
    setError('');
    try {
      if (!selectedCity) {
        setMovies([]);
        setLoading(false);
        return;
      }
      const params = new URLSearchParams();
      params.set('city', selectedCity);

      const cacheKey = `movies:${category || 'all'}:${selectedCity}`;
      // Check sessionStorage cache
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setMovies(parsed);
            setLoading(false);
          }
        }
      } catch {}

      let results;
      // Also fetch database movies
      const dbMoviesRes = await api.get<{ data: any }>(`/movies?${params.toString()}`);
      const dbMovies = Array.isArray(dbMoviesRes.data) ? dbMoviesRes.data : dbMoviesRes.data?.data || dbMoviesRes.data?.results || [];

      if (category === 'MOVIES') {
        const res = await api.get<{ success: boolean; data: any }>(`/scraper/movies?${params.toString()}`);
        results = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
        results.forEach((m: any) => { m._scraperSource = 'MOVIES'; });
      } else if (category === 'EVENTS') {
        const res = await api.get<{ success: boolean; data: any }>(`/scraper/events?${params.toString()}`);
        results = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.results || [];
        results.forEach((e: any) => { e._scraperSource = 'EVENTS'; });
      } else {
        // "All" — fetch both movies and events, merge into one list
        const [moviesRes, eventsRes] = await Promise.all([
          api.get<{ success: boolean; data: any }>(`/scraper/movies?${params.toString()}`),
          api.get<{ success: boolean; data: any }>(`/scraper/events?${params.toString()}`),
        ]);
        const movies = Array.isArray(moviesRes.data) ? moviesRes.data : moviesRes.data?.data || moviesRes.data?.results || [];
        const events = Array.isArray(eventsRes.data) ? eventsRes.data : eventsRes.data?.data || eventsRes.data?.results || [];
        // Tag items so we know what category they belong to
        movies.forEach((m: any) => { if (!m.category) m.category = 'Movie'; m._scraperSource = 'MOVIES'; });
        events.forEach((e: any) => { if (!e.category) e.category = 'Event'; e._scraperSource = 'EVENTS'; });
        results = [...movies, ...events];
      }

      // Merge database movies into results (avoid duplicates by title+city)
      const scraperKeys = new Set(results.map((m: any) => `${m.title}|${m.venue?.city || selectedCity}`));
      for (const dbm of dbMovies) {
        if (dbm.status === 'CANCELLED' || dbm.status === 'COMPLETED') continue;
        const key = `${dbm.title}|${dbm.venue?.city || selectedCity}`;
        if (!scraperKeys.has(key)) {
          dbm._dbSource = true;
          dbm.poster_url = dbm.posterUrl || dbm.poster_url;
          results.push(dbm);
          scraperKeys.add(key);
        }
      }

      setMovies(results);
      setLoading(false);
      // Update cache
      try { sessionStorage.setItem(cacheKey, JSON.stringify(results)); } catch {}
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const refreshMovies = async () => {
    if (!selectedCity) return;
    setRefreshing(true);
    try {
      await api.post(`/scraper/refresh-cache?city=${encodeURIComponent(selectedCity)}`);
      // Clear session cache and re-fetch
      const cacheKey = `movies:${category || 'all'}:${selectedCity}`;
      try { sessionStorage.removeItem(cacheKey); } catch {}
      await fetchMovies();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: search });
      if (selectedCity) params.set('city', selectedCity);
      const res = await api.get<{ success: boolean; data: Movie[] }>(`/search?${params.toString()}`);
      setMovies(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Movies & Events</h1>

      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search movies & events..."
            className="input-field"
          />
          <button type="submit" className="btn-primary">Search</button>
        </div>
      </form>

      {/* City + Category filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <input
            type="text"
            value={citySearch}
            onChange={(e) => { setCitySearch(e.target.value); setShowCityDropdown(true); }}
            onFocus={() => setShowCityDropdown(true)}
            onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
            placeholder={selectedCity || 'Search cities...'}
            className="input-field text-sm pr-8"
          />
          {selectedCity && !citySearch && (
            <button
              onClick={() => { setSelectedCity(''); setCitySearch(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
          {showCityDropdown && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <button
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!selectedCity ? 'bg-primary-50 font-medium' : ''}`}
                onMouseDown={() => { setSelectedCity(''); setCitySearch(''); setShowCityDropdown(false); }}
              >
                All cities
              </button>
              {filteredCities.map((city) => (
                <button
                  key={city}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedCity === city ? 'bg-primary-50 font-medium' : ''}`}
                  onMouseDown={() => { setSelectedCity(city); setCitySearch(''); setShowCityDropdown(false); }}
                >
                  {city}
                  {city === citySearch && <span className="text-xs text-gray-400 ml-2">(matched)</span>}
                </button>
              ))}
              {filteredCities.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-400">No cities found</p>
              )}
            </div>
          )}
          {geoCity && !selectedCity && (
            <p className="text-xs text-gray-400 mt-1">Detected location: {geoCity}</p>
          )}
        </div>

        {selectedCity && (
          <button
            onClick={refreshMovies}
            disabled={refreshing}
            className="text-sm px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-700 hover:border-primary transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setCategory('')}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              !category
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-gray-300 hover:border-primary'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? '' : cat)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                category === cat
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary'
              }`}
            >
              {cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4">
            {category
              ? `${category.charAt(0) + category.slice(1).toLowerCase()} in ${selectedCity}`
              : selectedCity
                ? `Movies & Events in ${selectedCity}`
                : 'All Events'}
          </h2>

          {!selectedCity ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">Select a city to browse events</p>
            </div>
          ) : movies.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg mb-8">
              <p className="text-gray-500">No {category ? category.toLowerCase() : 'movies or events'} found in {selectedCity}.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {movies.map((movie, idx) => {
                const hasDbId = !!movie.id;
                const isImporting = importingId === (movie.event_code || movie.title);
                const key = movie.id || movie.event_code || idx;
                if (hasDbId) {
                  return (
                    <Link key={key} href={`/movies/${movie.id}`} className="card hover:shadow-md transition-shadow block overflow-hidden">
                      {movie.poster_url ? (
                        <div className="relative w-full aspect-[2/3] bg-gray-100">
                          <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="relative w-full aspect-[2/3] bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
                          <span className="text-4xl font-bold text-primary/30">{movie.title?.charAt(0) || '?'}</span>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-medium bg-primary-100 text-primary px-2 py-1 rounded">
                            {movie.category || movie.genre?.split('|')[0] || 'General'}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${movie.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : movie.status === 'DRAFT' ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                            {movie.status === 'PUBLISHED' ? 'Now Showing' : movie.status === 'DRAFT' ? 'Coming Soon' : (movie.status || 'Now Showing')}
                          </span>
                        </div>
                        <h2 className="text-lg font-semibold mb-1">{movie.title}</h2>
                        {movie.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{movie.description}</p>}
                        <div className="text-sm text-gray-500">
                          {movie.language && <p>{movie.language.replace('|', ', ')}</p>}
                          {movie.venue?.name && <p>{movie.venue?.name} &middot; {movie.venue?.city}</p>}
                          {movie.event_date && <p className="text-xs text-gray-400 mt-1">{movie.event_date}</p>}
                        </div>
                      </div>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={key}
                    href={`/movies/scraper/${movie.event_code}?city=${selectedCity}${movie._scraperSource === 'EVENTS' ? '&mode=seats' : ''}`}
                    onClick={() => { try { sessionStorage.setItem(`event:${movie.event_code}`, JSON.stringify(movie)); } catch {} }}
                    className="card hover:shadow-md transition-shadow block overflow-hidden"
                  >
                    {movie.poster_url ? (
                      <div className="relative w-full aspect-[2/3] bg-gray-100">
                        <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="relative w-full aspect-[2/3] bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
                        <span className="text-4xl font-bold text-primary/30">{movie.title?.charAt(0) || '?'}</span>
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-medium bg-primary-100 text-primary px-2 py-1 rounded">
                          {movie.category || movie.genre?.split('|')[0] || 'General'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                          Now Showing
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold mb-1">{movie.title}</h2>
                      {movie.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{movie.description}</p>}
                      <div className="text-sm text-gray-500">
                        {movie.language && <p>{movie.language.replace('|', ', ')}</p>}
                        {movie.venue?.name && <p>{movie.venue?.name} &middot; {movie.venue?.city}</p>}
                        {movie.event_date && <p className="text-xs text-gray-400 mt-1">{movie.event_date}</p>}
                      </div>
                      <p className="text-xs text-primary font-medium mt-2">
                        View Details
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
