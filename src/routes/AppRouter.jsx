import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import PerfilLayout from '@/layouts/PerfilLayout';
import ProtectedRoute from './ProtectedRoute';
import Home from '@/modules/Home';
import Sportsbook from '@/modules/Sportsbook';
import Example from '@/modules/Example';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<MainLayout />}>            
          <Route index element={<Home />} />
          <Route path='sportsbook' element={<Sportsbook />} />
          <Route path='example' element={<Example />} />
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
