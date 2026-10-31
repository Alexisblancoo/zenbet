import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { TelemetryProvider } from '@/telemetry';

import AuthProvider from '@/context/AuthContext';
import AuthModalProvider from '@/context/AuthModalContext';
import { BetSlipProvider } from '@/context/BetSlipContext';
import { FightHubProvider } from '@/context/FightHubContext';
import AppRouter from './routes/AppRouter';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TelemetryProvider>
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
      </TelemetryProvider>
    </QueryClientProvider>
  );
}
