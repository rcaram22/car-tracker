import { Outlet } from 'react-router';
import { ThemeToggle } from './ThemeToggle';

export function Layout() {
  return (
    <div className="min-h-screen">
      <Outlet />
      <ThemeToggle />
    </div>
  );
}
