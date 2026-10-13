import { useState, type FormEvent } from 'react';
import { btnPrimary, inputCls } from '../../components/ui';

const ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/too-many-requests':
    'Demasiados intentos. Probá de nuevo en unos minutos.',
  'auth/network-request-failed':
    'Sin conexión. Hace falta internet para iniciar sesión.',
};

export function LoginPage({
  onSignIn,
}: {
  onSignIn: (email: string, password: string) => Promise<unknown>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(ERRORS[code] ?? 'No se pudo iniciar sesión.');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <h1 className="text-xl font-semibold">Car tracker</h1>
        <label className="block space-y-1 text-sm">
          <span>Correo</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className={`${btnPrimary} w-full`}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
