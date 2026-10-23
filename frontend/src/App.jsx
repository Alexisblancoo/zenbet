import { BrowserRouter } from 'react-router-dom';

import AuthProvider from '@/context/AuthContext';
import AuthModalProvider from '@/context/AuthModalContext';
import { BetSlipProvider } from '@/context/BetSlipContext';
import AppRouter from './routes/AppRouter';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthModalProvider>
          <BetSlipProvider>
            <AppRouter />
          </BetSlipProvider>
        </AuthModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
