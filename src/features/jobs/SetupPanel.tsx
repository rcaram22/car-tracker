import { Link } from 'react-router';
import { useToast } from '../../components/Toast';
import { useJobs } from '../../db/hooks';
import { updateListing } from '../../db/repository';
import { formatPrice } from '../../domain/format';
import { setupCost } from '../../domain/jobs';
import type { Listing } from '../../domain/listing';
import { PriorityBadge } from './PriorityBadge';

export function SetupPanel({ listing }: { listing: Listing }) {
  const jobs = useJobs();
  const toast = useToast();
  const checked = new Set(listing.jobIds ?? []);

  const toggle = (jobId: string) => {
    const next = checked.has(jobId)
      ? [...checked].filter((id) => id !== jobId)
      : [...checked, jobId];
    updateListing(listing.id, { jobIds: next }).catch(() =>
      toast('No se pudo guardar', 'error'),
    );
  };

  if (!jobs) return null;

  const fromJobs = setupCost({ jobIds: listing.jobIds }, jobs);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Puesta a punto</h2>
      {jobs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Todavía no cargaste trabajos. Armalos en el{' '}
          <Link
            to="/jobs"
            className="text-blue-600 dark:text-blue-400 underline"
          >
            catálogo de trabajos
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white dark:bg-gray-800 shadow-sm">
          <table className="w-full text-left text-sm">
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-gray-100 dark:border-gray-700"
                >
                  <td className="px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked.has(job.id)}
                        onChange={() => toggle(job.id)}
                        className="h-4 w-4"
                      />
                      {job.description}
                    </label>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatPrice(job.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PriorityBadge priority={job.priority} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dl className="ml-auto grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
        <dt className="text-gray-500 dark:text-gray-400">Trabajos marcados</dt>
        <dd className="text-right">{formatPrice(fromJobs)}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Otros gastos</dt>
        <dd className="text-right">{formatPrice(listing.extraCost ?? 0)}</dd>
        <dt className="font-semibold">Total puesta a punto</dt>
        <dd className="text-right font-semibold">
          {formatPrice(setupCost(listing, jobs))}
        </dd>
      </dl>
    </section>
  );
}
