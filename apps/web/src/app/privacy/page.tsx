import type { Metadata } from 'next';
import { PrivacyView } from '@/components/marketing/PrivacyView';

export const metadata: Metadata = {
  title: 'Privacy Policy & Zero-Telemetry Guarantee',
  description:
    'Our commitment to data sovereignty: zero tracking pixels, no telemetry backdoors, and local PostgreSQL data storage.',
  openGraph: {
    title: 'Privacy Policy & Zero-Telemetry Guarantee | Orbit',
    description:
      'Our commitment to data sovereignty: zero tracking pixels, no telemetry backdoors, and local PostgreSQL data storage.',
    url: 'https://orbit.chat/privacy',
  },
};

export default function Page() {
  return <PrivacyView />;
}
