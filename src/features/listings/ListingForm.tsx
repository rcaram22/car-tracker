import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useBlocker } from 'react-router';
import { StarRating } from '../../components/StarRating';
import { StatusSelect } from '../../components/Status';
import { useToast } from '../../components/Toast';
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui';
import { parseNumberInput } from '../../domain/format';
import type {
  Listing,
  ListingInput,
  ListingStatus,
  Photo,
  PhotoData,
  Rating,
} from '../../domain/listing';
import { PhotoDraftList } from '../photos/PhotoDraftList';
import { PhotoDropzone } from '../photos/PhotoDropzone';
import {
  addDrafts,
  draftsFromPhotos,
  EMPTY_DRAFTS,
  type PhotoDraftState,
} from '../photos/photoDrafts';

interface FieldState {
  model: string;
  color: string;
  year: string;
  km: string;
  price: string;
  url: string;
  condition: string;
  description: string;
  rating?: Rating;
  status: ListingStatus;
}

type TextField = Exclude<
  keyof FieldState,
  'rating' | 'status' | 'description'
>;

const TEXT_FIELDS: {
  key: TextField;
  label: string;
  numeric?: boolean;
  wide?: boolean;
}[] = [
  { key: 'model', label: 'Modelo *' },
  { key: 'color', label: 'Color' },
  { key: 'year', label: 'Año', numeric: true },
  { key: 'km', label: 'Kilómetros', numeric: true },
  { key: 'price', label: 'Precio (USD)', numeric: true },
  { key: 'condition', label: 'Condición' },
  { key: 'url', label: 'Link a la publicación', wide: true },
];

const toFields = (l?: Listing): FieldState => ({
  model: l?.model ?? '',
  color: l?.color ?? '',
  year: l?.year?.toString() ?? '',
  km: l?.km?.toString() ?? '',
  price: l?.price?.toString() ?? '',
  url: l?.url ?? '',
  condition: l?.condition ?? '',
  description: l?.description ?? '',
  rating: l?.rating,
  status: l?.status ?? 'new',
});

const blankToUndefined = (s: string) =>
  s.trim() === '' ? undefined : s.trim();

const toInput = (f: FieldState): ListingInput => ({
  model: f.model.trim(),
  color: blankToUndefined(f.color),
  year: parseNumberInput(f.year),
  km: parseNumberInput(f.km),
  price: parseNumberInput(f.price),
  url: blankToUndefined(f.url),
  condition: blankToUndefined(f.condition),
  description: f.description.trim() === '' ? undefined : f.description,
  rating: f.rating,
  status: f.status,
});

interface Props {
  initial?: Listing;
  initialPhotos?: Photo[];
  submitLabel: string;
  onSubmit: (input: ListingInput, photos: PhotoDraftState) => Promise<void>;
  onCancel: () => void;
}

export function ListingForm({
  initial,
  initialPhotos,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const toast = useToast();
  const [fields, setFields] = useState(() => toFields(initial));
  const [photos, setPhotos] = useState(() =>
    initialPhotos
      ? draftsFromPhotos(initialPhotos, initial?.coverPhotoId)
      : EMPTY_DRAFTS,
  );
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [error, setError] = useState<string>();
  const allowNav = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !allowNav.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Tenés cambios sin guardar. ¿Salir igual?')) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof FieldState>(key: K, value: FieldState[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    setDirty(true);
    if (key === 'model') setError(undefined);
  };

  const changePhotos = (fn: (s: PhotoDraftState) => PhotoDraftState) => {
    setPhotos(fn);
    setDirty(true);
  };

  const addPhotos = (added: PhotoData[]) =>
    changePhotos((s) =>
      addDrafts(
        s,
        added.map((p) => ({ key: crypto.randomUUID(), ...p })),
      ),
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (processingPhotos) return;
    if (!fields.model.trim()) {
      setError('El modelo es obligatorio');
      return;
    }
    setSubmitting(true);
    allowNav.current = true;
    try {
      await onSubmit(toInput(fields), photos);
    } catch {
      allowNav.current = false;
      toast('No se pudo guardar', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map(({ key, label, numeric, wide }) => (
          <Field key={key} id={`f-${key}`} label={label} wide={wide}>
            <input
              id={`f-${key}`}
              value={fields[key]}
              inputMode={numeric ? 'numeric' : undefined}
              type={key === 'url' ? 'url' : 'text'}
              onChange={(e) => set(key, e.target.value)}
              className={inputCls}
              aria-invalid={key === 'model' && !!error}
            />
            {key === 'model' && error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </Field>
        ))}
        <Field id="f-status" label="Estado">
          <StatusSelect
            id="f-status"
            value={fields.status}
            onChange={(v) => set('status', v)}
          />
        </Field>
        <Field label="Calificación">
          <StarRating
            value={fields.rating}
            onChange={(v) => set('rating', v)}
          />
        </Field>
        <Field id="f-description" label="Descripción de la publicación" wide>
          <textarea
            id="f-description"
            rows={6}
            value={fields.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Pegá acá el texto de la publicación"
            className={inputCls}
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Fotos</h2>
        <PhotoDropzone onAdd={addPhotos} onBusyChange={setProcessingPhotos} />
        <PhotoDraftList state={photos} onChange={changePhotos} />
      </section>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting || processingPhotos}
          className={btnPrimary}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  wide,
  children,
}: {
  id?: string;
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      {id ? (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      ) : (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}
      {children}
    </div>
  );
}
