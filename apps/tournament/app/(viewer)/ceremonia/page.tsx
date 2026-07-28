import { es } from '@/lib/i18n/es';
import { Placeholder } from '../components/Placeholder';

// Ceremony is locked in the nav until it starts (Epic 6); this stub keeps a direct visit from 404ing.
export const dynamic = 'force-dynamic';

export default function CeremoniaPage() {
  return <Placeholder body={es.placeholder.ceremony} />;
}
