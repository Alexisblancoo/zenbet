import AuthProvider from '@/context/AuthContext';
import { BetSlipProvider } from '@/context/BetSlipContext';
import AppRouter from './routes/AppRouter';

export default function App() {
  return (
    <AuthProvider>
      <BetSlipProvider>
        <AppRouter />
      </BetSlipProvider>
    </AuthProvider>
  );
}
