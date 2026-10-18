import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import PerfilLayout from '@/layouts/PerfilLayout';
import ProtectedRoute from './ProtectedRoute';
import Home from '@/modules/Home';
import Sportsbook from '@/modules/Sportsbook';
import Example from '@/modules/Example';
import Terms from '@/modules/Legal/Terms';
import Privacy from '@/modules/Legal/Privacy';
import Refunds from '@/modules/Legal/Refunds';
import RegisterPage from '@/modules/Auth/RegisterPage';
import LoginPage from '@/modules/Auth/LoginPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<MainLayout />}>            
          <Route index element={<Home />} />
          <Route path='sportsbook' element={<Sportsbook />} />
          <Route path='example' element={<Example />} />
          <Route path='terms' element={<Terms />} />
          <Route path='privacy' element={<Privacy />} />
          <Route path='refunds' element={<Refunds />} />
          <Route path='register' element={<RegisterPage />} />
          <Route path='login' element={<LoginPage />} />
          <Route
            path='perfil'
            element={
              <ProtectedRoute>
                <PerfilLayout />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
