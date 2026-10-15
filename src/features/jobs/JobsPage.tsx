import { useState } from 'react';
import { Link } from 'react-router';
import { useToast } from '../../components/Toast';
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui';
import { useJobs } from '../../db/hooks';
import { addJob, deleteJob, seedJobs, updateJob } from '../../db/repository';
import { parseNumberInput } from '../../domain/format';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  type Job,
  type Priority,
} from '../../domain/jobs';

export function JobsPage() {
  const jobs = useJobs();
  const toast = useToast();

  const run = (action: () => Promise<unknown>) =>
    action().catch(() => toast('No se pudo guardar', 'error'));

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Link
        to="/"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        ← Volver
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Trabajos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Lo que podés tener que hacerle a un auto. En cada publicación marcás
            los que aplican.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run(addJob)}
          className={btnPrimary}
        >
          + Agregar trabajo
        </button>
      </header>

      {jobs?.length === 0 && (
        <div className="space-y-3 rounded-lg bg-white dark:bg-gray-800 p-6 text-center shadow-sm">
          <p className="text-gray-500 dark:text-gray-400">
            Todavía no cargaste trabajos.
          </p>
          <button
            type="button"
            onClick={() => void run(seedJobs)}
            className={btnSecondary}
          >
            Cargar mi lista inicial (12 trabajos)
          </button>
        </div>
      )}

      {!!jobs?.length && (
        <div className="overflow-x-auto rounded-lg bg-white dark:bg-gray-800 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2 font-medium">Descripción</th>
                <th className="px-3 py-2 font-medium">Monto (USD)</th>
                <th className="px-3 py-2 font-medium">Prioridad</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} onSave={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function JobRow({
  job,
  onSave,
}: {
  job: Job;
  onSave: (action: () => Promise<unknown>) => void;
}) {
  const [description, setDescription] = useState(job.description);
  const [amount, setAmount] = useState(job.amount?.toString() ?? '');

  const save = (patch: Partial<Omit<Job, 'id' | 'createdAt'>>) =>
    onSave(() => updateJob(job.id, patch));

  const remove = () => {
    if (!window.confirm(`¿Borrar "${job.description}" del catálogo?`)) return;
    onSave(() => deleteJob(job.id));
  };

  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      <td className="px-3 py-2">
        <input
          aria-label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            const next = description.trim();
            if (!next) setDescription(job.description);
            else if (next !== job.description) save({ description: next });
          }}
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2">
        <input
          aria-label="Monto"
          inputMode="numeric"
          placeholder="??"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const next = parseNumberInput(amount);
            setAmount(next?.toString() ?? '');
            if (next !== job.amount) save({ amount: next });
          }}
          className={`${inputCls} !w-28`}
        />
      </td>
      <td className="px-3 py-2">
        <select
          aria-label="Prioridad"
          value={job.priority}
          onChange={(e) => save({ priority: e.target.value as Priority })}
          className={`${inputCls} !w-auto`}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          aria-label="Borrar trabajo"
          onClick={remove}
          className="text-xs text-red-600 dark:text-red-400 hover:underline"
        >
          Borrar
        </button>
      </td>
    </tr>
  );
}
