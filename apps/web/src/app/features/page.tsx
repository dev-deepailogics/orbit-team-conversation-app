import type { Metadata } from 'next';
import { FeaturesView } from '@/components/marketing/FeaturesView';

export const metadata: Metadata = {
  title: 'Features & Architecture',
  description:
    'Deep dive into Orbit: Real-time channels, cursor pagination, LiveKit SFU audio/video huddles, and Slack-compatible bot token platform.',
  openGraph: {
    title: 'Features & Architecture | Orbit',
    description:
      'Deep dive into Orbit: Real-time channels, cursor pagination, LiveKit SFU audio/video huddles, and Slack-compatible bot token platform.',
    url: 'https://orbit.chat/features',
  },
};

export default function Page() {
  return <FeaturesView />;
}
