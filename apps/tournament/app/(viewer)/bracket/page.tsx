import { es } from '@/lib/i18n/es';
import { Placeholder } from '../components/Placeholder';

// Story 5.7 owns the bracket surface; 5.6 provides the route target so the nav shell never 404s.
export const dynamic = 'force-dynamic';

export default function BracketPage() {
  return <Placeholder body={es.placeholder.bracket} />;
}
