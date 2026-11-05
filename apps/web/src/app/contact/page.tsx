import type { Metadata } from 'next';
import { ContactView } from '@/components/marketing/ContactView';

export const metadata: Metadata = {
  title: 'Contact Engineering & Sales',
  description:
    'Get in touch with Orbit platform architects for self-hosted support, air-gapped deployments, custom SLAs, and bot migration assistance.',
  openGraph: {
    title: 'Contact Engineering & Sales | Orbit',
    description:
      'Get in touch with Orbit platform architects for self-hosted support, air-gapped deployments, custom SLAs, and bot migration assistance.',
    url: 'https://orbit.chat/contact',
  },
};

export default function Page() {
  return <ContactView />;
}
