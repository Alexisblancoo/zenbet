import { useNavigate } from 'react-router-dom';
import AuthModal from './AuthModal';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className='min-h-screen w-full bg-obsidian-void flex items-center justify-center p-4'>
      <AuthModal
        isOpen={true}
        initialMode='login'
        onClose={() => navigate('/')}
        onAuthSuccess={() => navigate('/sportsbook')}
      />
    </div>
  );
}
