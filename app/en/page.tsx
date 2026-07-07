import type { Metadata } from 'next';
import Landing from '../components/landing/Landing';
import { landingMetadata } from '@/lib/seo';

export const metadata: Metadata = landingMetadata('en');

export default function HomeEn() {
  return <Landing locale="en" />;
}
