import type { Metadata } from 'next';
import PublicLanding from '../components/landing/PublicLanding';
import { publicLandingMetadata } from '@/lib/seo';

export const metadata: Metadata = publicLandingMetadata();

export default function HomePt() {
  return <PublicLanding />;
}
