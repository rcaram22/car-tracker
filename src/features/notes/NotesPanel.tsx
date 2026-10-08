import { useState, type FormEvent } from 'react';
import { useToast } from '../../components/Toast';
import { btnPrimary, inputCls } from '../../components/ui';
import { useNotes } from '../../db/hooks';
import { addNote, deleteNote } from '../../db/repository';
import { formatDateTime } from '../../domain/format';

export function NotesPanel({ listingId }: { listingId: string }) {
  const notes = useNotes(listingId);
  const toast = useToast();
  const [text, setText] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    try {
      await addNote(listingId, t);
      setText('');
    } catch {
      toast('No se pudo guardar la nota', 'error');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('¿Borrar esta nota?')) return;
    try {
      await deleteNote(id);
    } catch {
      toast('No se pudo borrar la nota', 'error');
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Notas</h2>
      {notes?.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin notas todavía.</p>
      )}
      <ul className="space-y-2">
        {notes?.map((n) => (
          <li key={n.id} className="rounded-lg bg-white dark:bg-gray-800 p-3 shadow-sm">
            <p className="whitespace-pre-wrap">{n.text}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <time>{formatDateTime(n.createdAt)}</time>
              <button
                type="button"
                aria-label="Borrar nota"
                onClick={() => void remove(n.id)}
                className="text-red-600 dark:text-red-400 hover:underline"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="space-y-2">
        <textarea
          aria-label="Nueva nota"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribí una nota para vos…"
          className={inputCls}
        />
        <button type="submit" disabled={!text.trim()} className={btnPrimary}>
          Agregar nota
        </button>
      </form>
    </section>
  );
}
