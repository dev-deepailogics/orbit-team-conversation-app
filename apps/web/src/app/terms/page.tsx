import type { Metadata } from 'next';
import { TermsView } from '@/components/marketing/TermsView';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of service, platform licensing guidelines, and managed cloud agreements for Orbit.',
  openGraph: {
    title: 'Terms of Service | Orbit',
    description:
      'Terms of service, platform licensing guidelines, and managed cloud agreements for Orbit.',
    url: 'https://orbit.chat/terms',
  },
};

export default function Page() {
  return <TermsView />;
}
