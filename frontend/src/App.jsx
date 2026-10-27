import { BrowserRouter } from 'react-router-dom';

import AuthProvider from '@/context/AuthContext';
import AuthModalProvider from '@/context/AuthModalContext';
import { BetSlipProvider } from '@/context/BetSlipContext';
import { FightHubProvider } from '@/context/FightHubContext';
import AppRouter from './routes/AppRouter';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthModalProvider>
          <FightHubProvider>
            <BetSlipProvider>
              <AppRouter />
            </BetSlipProvider>
          </FightHubProvider>
        </AuthModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
