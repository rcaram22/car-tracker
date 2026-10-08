import { Link } from 'react-router';

export function NotFound({
  message = 'No encontramos esa página.',
}: {
  message?: string;
}) {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <p className="mb-4 text-gray-600">{message}</p>
      <Link to="/" className="text-blue-600 underline">
        Volver al listado
      </Link>
    </div>
  );
}
