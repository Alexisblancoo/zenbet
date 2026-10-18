import { Navigate, useLocation } from 'react-router-dom';

export function ProtectedRoute({ children }) {
  const token = localStorage.getItem('zenbet_token');
  const location = useLocation();
  if (!token) {
    return <Navigate to='/login' state={{ from: location }} replace />;
  }
  return children;
}

export default ProtectedRoute;
