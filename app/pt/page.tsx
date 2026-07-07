import type { Metadata } from 'next';
import Landing from '../components/landing/Landing';
import { landingMetadata } from '@/lib/seo';

export const metadata: Metadata = landingMetadata('pt');

export default function HomePt() {
  return <Landing locale="pt" />;
}
