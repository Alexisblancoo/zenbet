import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/authState';

export type UserRole = 'Rookie' | 'Pro' | 'Admin' | string;

export interface ProtectedRouteProps {
  readonly children: React.ReactNode;
  readonly allowedRoles?: readonly UserRole[];
  readonly requireKyc?: boolean;
  readonly redirectTo?: string;
}

/**
 * Guardián de rutas con verificación de autenticación, roles granulares (Rookie, Pro, Admin)
 * y estado de verificación de identidad KYC.
 */
export function ProtectedRoute({
  children,
  allowedRoles,
  requireKyc = false,
  redirectTo = '/login',
}: ProtectedRouteProps): React.ReactElement {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#050505]">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-[#D4FF3F]">
          <Loader2 size={16} className="animate-spin text-[#D4FF3F]" aria-hidden="true" />
          <span>Verificando Credenciales de Sesión...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // 1. Control de acceso por Roles (Rookie / Pro / Admin)
  if (allowedRoles && allowedRoles.length > 0) {
    const rawRoles = (user as unknown as { roles?: readonly string[] }).roles ?? [];
    const hasRequiredRole = allowedRoles.some((role) =>
      rawRoles.map((r) => r.toLowerCase()).includes(role.toLowerCase())
    );

    if (!hasRequiredRole) {
      return (
        <div className="min-h-[70vh] bg-[#050505] p-8 flex items-center justify-center">
          <div className="max-w-md w-full border border-red-500/40 bg-[#0D0D0D] p-6 rounded shadow-2xl text-left">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <ShieldAlert size={24} />
              <h2 className="font-display font-black text-lg uppercase tracking-wide text-white">
                Acceso Denegado (403 Forbidden)
              </h2>
            </div>
            <p className="font-mono text-xs text-neutral-400 leading-relaxed">
              Tu cuenta no cuenta con los privilegios suficientes para ingresar a esta sección. Se requiere uno de los siguientes roles: {allowedRoles.join(', ')}.
            </p>
          </div>
        </div>
      );
    }
  }

  // 2. Control de verificación KYC
  if (requireKyc) {
    const kycStatus = (user as unknown as { kycStatus?: string }).kycStatus;
    if (kycStatus && kycStatus !== 'VERIFIED') {
      return (
        <div className="min-h-[70vh] bg-[#050505] p-8 flex items-center justify-center">
          <div className="max-w-md w-full border border-amber-500/40 bg-[#0D0D0D] p-6 rounded shadow-2xl text-left">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <ShieldAlert size={24} />
              <h2 className="font-display font-black text-lg uppercase tracking-wide text-white">
                Verificación KYC Requerida
              </h2>
            </div>
            <p className="font-mono text-xs text-neutral-400 leading-relaxed mb-4">
              Por regulaciones normativas de iGaming, debes validar tu documento de identidad para realizar retiros o desbloquear límites de apuestas.
            </p>
            <a
              href="/wallet"
              className="inline-block py-2 px-4 bg-[#D4FF3F] text-black font-display font-black text-xs uppercase rounded transition hover:bg-[#bce42f]"
            >
              Completar Verificación en Billetera
            </a>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;

