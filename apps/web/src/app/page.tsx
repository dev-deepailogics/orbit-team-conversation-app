import type { Metadata } from 'next';
import { HomeView } from '@/components/marketing/HomeView';

export const metadata: Metadata = {
  title: 'Orbit - All-in-One Team Collaboration Workspace',
  description:
    'Chat channels, interactive whiteboard canvas, project ticket tracking, rich collaborative documents, team availability, and calling — unified in one beautiful workspace.',
  openGraph: {
    title: 'Orbit - All-in-One Team Collaboration Workspace',
    description:
      'Chat channels, interactive whiteboard canvas, project ticket tracking, rich collaborative documents, team availability, and calling — unified in one beautiful workspace.',
    url: 'https://orbit.chat',
  },
};

export default function Page() {
  return <HomeView />;
}
