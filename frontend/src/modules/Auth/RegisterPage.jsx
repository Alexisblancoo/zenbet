import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/authState';

import AuthPageLayout from './components/AuthPageLayout';
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
    <AuthPageLayout mode='register'>
      <RegisterModal
        isOpen
        variant='page'
        onClose={() => navigate('/')}
        onSuccess={() => navigate(redirectTo, { replace: true })}
        onSwitchToLogin={() => navigate('/login')}
      />
    </AuthPageLayout>
  );
}
