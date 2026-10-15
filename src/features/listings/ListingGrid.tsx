import type { Job } from '../../domain/jobs';
import type { Listing } from '../../domain/listing';
import { ListingCard } from './ListingCard';

export function ListingGrid({
  listings,
  jobs,
}: {
  listings: Listing[];
  jobs?: Job[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} jobs={jobs} />
      ))}
    </div>
  );
}
