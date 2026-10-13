import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { useEffect, useState, type ReactNode } from 'react';
import { useToast } from '../../components/Toast';
import { auth, firestore } from '../../sync/firebase';
import { startSync } from '../../sync/firestoreSync';
import { LoginPage } from './LoginPage';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const toast = useToast();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    return startSync(firestore, (e) => {
      console.error(e);
      const code = (e as { code?: string }).code;
      toast(
        code === 'permission-denied'
          ? 'Tu usuario no tiene acceso a la nube.'
          : 'No se pudo sincronizar con la nube.',
        'error',
      );
    });
  }, [user, toast]);

  if (user === undefined) return null;
  if (!user)
    return (
      <LoginPage
        onSignIn={(email, password) =>
          signInWithEmailAndPassword(auth, email, password)
        }
      />
    );

  return (
    <>
      {children}
      <button
        type="button"
        onClick={() => void signOut(auth)}
        title={`Cerrar sesión (${user.email})`}
        className="fixed bottom-4 left-16 z-30 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        Salir
      </button>
    </>
  );
}
