import { es } from '@/lib/i18n/es';
import { Placeholder } from '../components/Placeholder';

// Story 5.7 owns the leaderboards surface; 5.6 provides the route target so the nav shell never 404s.
export const dynamic = 'force-dynamic';

export default function LeaderboardsPage() {
  return <Placeholder body={es.placeholder.stats} />;
}
