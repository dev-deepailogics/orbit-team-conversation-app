import type { Metadata } from 'next';
import { AboutView } from '@/components/marketing/AboutView';

export const metadata: Metadata = {
  title: 'About & Manifesto',
  description:
    'Why we built Orbit: Bringing data sovereignty, ultra-low latency, and modern design back to team communication.',
  openGraph: {
    title: 'About & Manifesto | Orbit',
    description:
      'Why we built Orbit: Bringing data sovereignty, ultra-low latency, and modern design back to team communication.',
    url: 'https://orbit.chat/about',
  },
};

export default function Page() {
  return <AboutView />;
}
