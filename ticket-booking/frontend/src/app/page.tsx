'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <section className="text-center mb-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Your Gateway to Amazing Events
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Book tickets for concerts, theater shows, and events with ease.
          Real-time seat selection, instant QR tickets, and secure booking.
        </p>
        <Link href="/movies" className="btn-primary text-lg px-8 py-3">
          Browse Movies & Events
        </Link>
      </section>

      <section className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="card text-center">
          <div className="text-4xl mb-4">🎭</div>
          <h3 className="text-lg font-semibold mb-2">Browse Events</h3>
          <p className="text-gray-600">Discover concerts, theater, and cultural events near you.</p>
        </div>
        <div className="card text-center">
          <div className="text-4xl mb-4">💺</div>
          <h3 className="text-lg font-semibold mb-2">Select Seats</h3>
          <p className="text-gray-600">Interactive seat maps with real-time availability.</p>
        </div>
        <div className="card text-center">
          <div className="text-4xl mb-4">🎟️</div>
          <h3 className="text-lg font-semibold mb-2">Instant QR Ticket</h3>
          <p className="text-gray-600">Get your QR ticket immediately after booking.</p>
        </div>
      </section>
    </div>
  );
}
