import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';

const Home = lazy(() => import('@/modules/Home'));
const Sportsbook = lazy(() => import('@/modules/Sportsbook'));
const Terms = lazy(() => import('@/modules/Legal/Terms'));
const Privacy = lazy(() => import('@/modules/Legal/Privacy'));
const Refunds = lazy(() => import('@/modules/Legal/Refunds'));
const RegisterPage = lazy(() => import('@/modules/Auth/RegisterPage'));
const LoginPage = lazy(() => import('@/modules/Auth/LoginPage'));
const WalletPage = lazy(() => import('@/pages/WalletPage'));
const MyBetsPage = lazy(() => import('@/pages/MyBetsPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));

export default function AppRouter() {
  return (
    <Routes>
      <Route path='/' element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path='sportsbook' element={<Sportsbook />} />
        <Route path='terms' element={<Terms />} />
        <Route path='privacy' element={<Privacy />} />
        <Route path='refunds' element={<Refunds />} />
        <Route path='register' element={<RegisterPage />} />
        <Route path='login' element={<LoginPage />} />
        <Route
          path='wallet'
          element={
            <ProtectedRoute>
              <WalletPage />
            </ProtectedRoute>
          }
        />
        <Route
          path='my-bets'
          element={
            <ProtectedRoute>
              <MyBetsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path='perfil'
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
