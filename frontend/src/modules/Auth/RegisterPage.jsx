import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/authState';
import RegisterModal from './RegisterModal';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const redirectTo = location.state?.from?.pathname ?? '/sportsbook';

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className='flex min-h-screen w-full items-center justify-center bg-canvas p-4'>
      <RegisterModal
        isOpen={true}
        onClose={() => navigate('/')}
        onSuccess={() => navigate(redirectTo, { replace: true })}
        onSwitchToLogin={() => navigate('/login')}
      />
    </div>
  );
}
