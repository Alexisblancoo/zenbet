import { useState, type FormEvent } from 'react';
import { ArrowRight, Lock, User } from 'lucide-react';

import { isProblemDetailsException, normalizeApiError } from '@/api';
import { useAuth } from '@/context/authState';
import type { AuthUser, LoginCredentials } from '@/domain/auth';

import AuthErrorAlert from './components/AuthErrorAlert';
import AuthField from './components/AuthField';
import AuthModalShell from './components/AuthModalShell';
import AuthSubmitButton from './components/AuthSubmitButton';
import {
  mapProblemToFieldErrors,
  resolveAuthErrorMessage,
  type AuthFieldAliases,
} from './lib/authErrors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_ALIASES: AuthFieldAliases = {
  identifier: ['identifier', 'email', 'username'],
  password: ['password'],
};

type FieldName = 'identifier' | 'password';
type TouchedFields = Partial<Record<FieldName, boolean>>;

interface LoginModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (user: AuthUser) => void;
  readonly onSwitchToRegister?: () => void;
  readonly variant?: 'modal' | 'page';
}

export default function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToRegister,
  variant = 'modal',
}: LoginModalProps) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<TouchedFields>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedIdentifier = identifier.trim();
  const identifierLooksLikeEmail = trimmedIdentifier.includes('@');
  const identifierValid =
    trimmedIdentifier.length > 0 &&
    (!identifierLooksLikeEmail || EMAIL_PATTERN.test(trimmedIdentifier));

  const localErrors: Partial<Record<FieldName, string>> = {};

  if (!trimmedIdentifier) {
    localErrors.identifier = 'Ingresa tu correo o nombre de usuario.';
  } else if (identifierLooksLikeEmail && !EMAIL_PATTERN.test(trimmedIdentifier)) {
    localErrors.identifier = 'Ingresa un correo electrónico válido.';
  }

  if (!password) {
    localErrors.password = 'Ingresa tu contraseña.';
  }

  const clearFieldError = (field: FieldName) => {
    setServerErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
    if (formError) setFormError('');
  };

  const touchField = (field: FieldName) => {
    setTouched((previous) => (previous[field] ? previous : { ...previous, [field]: true }));
  };

  const fieldError = (field: FieldName): string | undefined =>
    serverErrors[field] ?? (touched[field] ? localErrors[field] : undefined);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (Object.keys(localErrors).length > 0) {
      setTouched({ identifier: true, password: true });
      setServerErrors({});
      setFormError('');
      return;
    }

    setServerErrors({});
    setFormError('');
    setIsSubmitting(true);

    try {
      const credentials: LoginCredentials = {
        identifier: trimmedIdentifier,
        password,
      };
      const authenticatedUser = await login(credentials);

      setPassword('');
      setTouched({});

      if (onSuccess) {
        onSuccess(authenticatedUser);
      } else {
        onClose();
      }
    } catch (error) {
      const problem = isProblemDetailsException(error) ? error : normalizeApiError(error);
      const mappedErrors = mapProblemToFieldErrors(problem, FIELD_ALIASES);
      const mappedFieldNames = Object.keys(mappedErrors) as FieldName[];

      if (mappedFieldNames.length > 0) {
        setServerErrors(mappedErrors);
        setTouched((previous) => ({
          ...previous,
          ...Object.fromEntries(mappedFieldNames.map((field) => [field, true])),
        }));
        setFormError('');
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
    setTouched({});
    setServerErrors({});
    setFormError('');
    onClose();
  };

  return (
    <AuthModalShell
      isOpen={isOpen}
      onClose={handleClose}
      variant={variant}
      eyebrow='Acceso de jugador'
      title='Entrar a tu cuenta'
      description='Accede a tu billetera y continúa tus apuestas en las próximas carteleras UFC.'
      footer={
        <p className='text-center text-xs text-metallic-slate'>
          ¿Aún no tienes cuenta?{' '}
          <button
            type='button'
            onClick={onSwitchToRegister}
            className='focus-ring font-semibold text-crimson transition-colors hover:text-crimson-200'
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
          label='Correo o usuario'
          icon={User}
          value={identifier}
          onChange={(value) => {
            setIdentifier(value);
            clearFieldError('identifier');
          }}
          onBlur={() => touchField('identifier')}
          placeholder='tu@correo.com'
          autoComplete='username'
          inputMode='email'
          error={fieldError('identifier')}
          valid={identifierValid}
          successMessage='Datos listos.'
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
          onBlur={() => touchField('password')}
          placeholder='Tu contraseña'
          autoComplete='current-password'
          error={fieldError('password')}
        />

        <AuthSubmitButton isSubmitting={isSubmitting} loadingLabel='Validando sesión...'>
          <span>Entrar</span>
          <ArrowRight size={14} aria-hidden='true' />
        </AuthSubmitButton>
      </form>
    </AuthModalShell>
  );
}
