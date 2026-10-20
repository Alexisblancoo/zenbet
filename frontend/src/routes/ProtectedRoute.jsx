import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/authState';

export function ProtectedRoute({ children, redirectTo = '/login' }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className='flex min-h-[60vh] items-center justify-center bg-canvas'>
        <div className='flex items-center gap-2 font-mono text-xs uppercase tracking-brutal text-ink-muted'>
          <Loader2 size={14} className='animate-spin text-crimson' aria-hidden='true' />
          <span>Verificando sesión...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
