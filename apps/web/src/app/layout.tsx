import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Orbit - Team Communication Platform',
  description: 'Self-hosted Slack alternative with channels, direct messages, huddle audio/video calls, and bot integrations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#1A1D21] text-gray-100 antialiased h-screen overflow-hidden flex flex-col">
        {children}
      </body>
    </html>
  );
}
