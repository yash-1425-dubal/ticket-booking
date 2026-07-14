'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="text-xl font-bold text-primary">
            TicketBook
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/movies" className="text-gray-600 hover:text-primary transition-colors">
              Movies & Events
            </Link>
            {loading ? null : user ? (
              <>
                {user.role === 'ORGANIZER' && (
                  <Link href="/organizer/dashboard" className="btn-outline text-sm">Dashboard</Link>
                )}
                {user.role === 'ADMIN' && (
                  <Link href="/admin/dashboard" className="btn-outline text-sm">Admin</Link>
                )}
                <Link href="/bookings" className="btn-outline text-sm">
                  My Bookings
                </Link>
                <Link href="/waitlist" className="btn-outline text-sm">
                  Waitlist
                </Link>
                <Link href="/profile" className="text-sm text-gray-500 hover:text-primary">
                  {user.name}
                </Link>
                <button onClick={logout} className="btn-primary text-sm">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-outline text-sm">
                  Login
                </Link>
                <Link href="/register" className="btn-primary text-sm">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
