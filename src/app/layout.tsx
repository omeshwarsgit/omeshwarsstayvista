import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StayVista Rate Parity Engine | Multi-Channel Distribution Intelligence',
  description: 'Enterprise-grade rate parity monitoring system auditing StayVista direct rates vs Airbnb, MakeMyTrip, Agoda, and Booking.com across 1,187 luxury villas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
