import { useState, type FormEvent } from 'react';
import { Lock, Mail } from 'lucide-react';

import { isProblemDetailsException, normalizeApiError } from '@/api';
import { useAuth } from '@/context/authState';
import type { AuthUser, LoginCredentials } from '@/domain/auth';

import AuthErrorAlert from './components/AuthErrorAlert';
import AuthField from './components/AuthField';
import AuthModalShell from './components/AuthModalShell';
import AuthSubmitButton from './components/AuthSubmitButton';
import { mapProblemToFieldErrors, resolveAuthErrorMessage, type AuthFieldAliases } from './lib/authErrors';

const FIELD_ALIASES: AuthFieldAliases = {
  identifier: ['identifier', 'email', 'username'],
  password: ['password'],
};

interface LoginModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (user: AuthUser) => void;
  readonly onSwitchToRegister?: () => void;
}

export default function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToRegister,
}: LoginModalProps) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (field: string) => {
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const localErrors: Record<string, string> = {};
    if (!identifier.trim()) localErrors.identifier = 'Ingresa tu email o nombre de usuario.';
    if (!password) localErrors.password = 'Ingresa tu contraseña.';

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setFormError('');
      return;
    }

    setFieldErrors({});
    setFormError('');
    setIsSubmitting(true);

    try {
      const credentials: LoginCredentials = { identifier: identifier.trim(), password };
      const authenticatedUser = await login(credentials);

      setPassword('');
      setIsSubmitting(false);
      onSuccess?.(authenticatedUser);
      onClose();
    } catch (error) {
      const problem = isProblemDetailsException(error) ? error : normalizeApiError(error);
      const mappedErrors = mapProblemToFieldErrors(problem, FIELD_ALIASES);

      if (Object.keys(mappedErrors).length > 0) {
        setFieldErrors(mappedErrors);
        setFormError(problem.isUnprocessableEntity ? resolveAuthErrorMessage(problem) : '');
      } else {
        setFormError(resolveAuthErrorMessage(problem));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setPassword('');
    setFieldErrors({});
    setFormError('');
    onClose();
  };

  return (
    <AuthModalShell
      isOpen={isOpen}
      onClose={handleClose}
      eyebrow='Acceso seguro'
      title='Entrar a Zenbet'
      description='Usa tus credenciales para operar cuotas en vivo y gestionar tu billetera.'
      footer={
        <p className='text-center text-xs text-ink-faint'>
          ¿No tienes cuenta?{' '}
          <button
            type='button'
            onClick={onSwitchToRegister}
            className='focus-ring font-semibold text-crimson transition-colors duration-base hover:text-crimson-300'
          >
            Crear una cuenta
          </button>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className='space-y-4'>
        <AuthErrorAlert message={formError} />

        <AuthField
          id='login-identifier'
          label='Email o usuario'
          icon={Mail}
          value={identifier}
          onChange={(value) => {
            setIdentifier(value);
            clearFieldError('identifier');
          }}
          placeholder='trader@zenbet.com'
          autoComplete='username'
          error={fieldErrors.identifier}
        />

        <AuthField
          id='login-password'
          label='Contraseña'
          icon={Lock}
          type='password'
          value={password}
          onChange={(value) => {
            setPassword(value);
            clearFieldError('password');
          }}
          placeholder='••••••••••'
          autoComplete='current-password'
          error={fieldErrors.password}
        />

        <AuthSubmitButton isSubmitting={isSubmitting} loadingLabel='Validando sesión...'>
          Entrar a la terminal
        </AuthSubmitButton>
      </form>
    </AuthModalShell>
  );
}
