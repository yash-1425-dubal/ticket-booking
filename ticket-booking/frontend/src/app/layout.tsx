import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import AuthGuard from '@/components/AuthGuard';

export const metadata: Metadata = {
  title: 'Ticket Booking System',
  description: 'Book tickets for events, concerts, and shows',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthGuard>
            <Navbar />
            <main className="min-h-screen">{children}</main>
            <footer className="text-center text-gray-400 text-xs py-6 border-t border-gray-100">
              &copy; 2026 Yash Dubal. All rights reserved.
            </footer>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
