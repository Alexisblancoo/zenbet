import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail, ShieldCheck, User } from 'lucide-react';

import { isProblemDetailsException, normalizeApiError } from '@/api';
import { useAuth } from '@/context/authState';
import type { AuthUser, RegisterPayload } from '@/domain/auth';

import AuthErrorAlert from './components/AuthErrorAlert';
import AuthField from './components/AuthField';
import AuthModalShell from './components/AuthModalShell';
import AuthSubmitButton from './components/AuthSubmitButton';
import PasswordStrength from './components/PasswordStrength';
import {
  mapProblemToFieldErrors,
  resolveAuthErrorMessage,
  type AuthFieldAliases,
} from './lib/authErrors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INITIAL_BALANCE = 1000;

const FIELD_ALIASES: AuthFieldAliases = {
  username: ['username', 'Username'],
  email: ['email', 'Email'],
  password: ['password', 'Password'],
  termsAccepted: ['termsAccepted', 'TermsAccepted', 'terms'],
};

interface RegisterModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (user: AuthUser) => void;
  readonly onSwitchToLogin?: () => void;
}

export default function RegisterModal({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToLogin,
}: RegisterModalProps) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
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

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (username.trim().length < 3) {
      errors.username = 'El usuario debe tener al menos 3 caracteres.';
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = 'Ingresa un correo electrónico válido.';
    }

    if (password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres.';
    }

    if (confirmPassword !== password) {
      errors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    if (!termsAccepted) {
      errors.termsAccepted = 'Debes aceptar los términos y la política de privacidad.';
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const localErrors = validate();
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setFormError('');
      return;
    }

    setFieldErrors({});
    setFormError('');
    setIsSubmitting(true);

    try {
      const payload: RegisterPayload = {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        initialBalance: INITIAL_BALANCE,
        termsAccepted: true,
      };

      const authenticatedUser = await register(payload);

      setPassword('');
      setConfirmPassword('');
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
    setConfirmPassword('');
    setFieldErrors({});
    setFormError('');
    onClose();
  };

  return (
    <AuthModalShell
      isOpen={isOpen}
      onClose={handleClose}
      eyebrow='Nueva cuenta'
      title='Crear cuenta Zenbet'
      description='Regístrate para operar con cuotas en vivo, wallet protegida y liquidación atómica.'
      footer={
        <p className='text-center text-xs text-ink-faint'>
          ¿Ya tienes cuenta?{' '}
          <button
            type='button'
            onClick={onSwitchToLogin}
            className='focus-ring font-semibold text-crimson transition-colors duration-base hover:text-crimson-300'
          >
            Iniciar sesión
          </button>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className='space-y-4'>
        <AuthErrorAlert message={formError} />

        <AuthField
          id='register-username'
          label='Nombre de usuario'
          icon={User}
          value={username}
          onChange={(value) => {
            setUsername(value);
            clearFieldError('username');
          }}
          placeholder='trader_elite'
          autoComplete='username'
          error={fieldErrors.username}
        />

        <AuthField
          id='register-email'
          label='Correo electrónico'
          icon={Mail}
          type='email'
          value={email}
          onChange={(value) => {
            setEmail(value);
            clearFieldError('email');
          }}
          placeholder='usuario@zenbet.com'
          autoComplete='email'
          error={fieldErrors.email}
        />

        <div className='space-y-2'>
          <AuthField
            id='register-password'
            label='Contraseña'
            icon={Lock}
            type='password'
            value={password}
            onChange={(value) => {
              setPassword(value);
              clearFieldError('password');
              clearFieldError('confirmPassword');
            }}
            placeholder='Mínimo 6 caracteres'
            autoComplete='new-password'
            error={fieldErrors.password}
          />
          <PasswordStrength password={password} />
        </div>

        <AuthField
          id='register-confirm-password'
          label='Confirmar contraseña'
          icon={ShieldCheck}
          type='password'
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            clearFieldError('confirmPassword');
          }}
          placeholder='Repite tu contraseña'
          autoComplete='new-password'
          error={fieldErrors.confirmPassword}
        />

        <div className='space-y-1.5'>
          <label className='flex cursor-pointer items-start gap-2.5 rounded-md border border-line/70 bg-surface-raised/40 p-3'>
            <input
              type='checkbox'
              checked={termsAccepted}
              onChange={(event) => {
                setTermsAccepted(event.target.checked);
                clearFieldError('termsAccepted');
              }}
              aria-invalid={Boolean(fieldErrors.termsAccepted)}
              className='focus-ring mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-xs border-line bg-canvas-raised accent-crimson'
            />
            <span className='text-xs leading-relaxed text-ink-muted'>
              Acepto los{' '}
              <Link
                to='/terms'
                className='font-semibold text-ink underline decoration-line-strong underline-offset-2 transition-colors duration-base hover:text-crimson'
              >
                Términos y Condiciones
              </Link>{' '}
              y la{' '}
              <Link
                to='/privacy'
                className='font-semibold text-ink underline decoration-line-strong underline-offset-2 transition-colors duration-base hover:text-crimson'
              >
                Política de Privacidad
              </Link>
              .
            </span>
          </label>

          {fieldErrors.termsAccepted ? (
            <p role='alert' className='font-mono text-xs text-odds-down'>
              {fieldErrors.termsAccepted}
            </p>
          ) : null}
        </div>

        <AuthSubmitButton isSubmitting={isSubmitting} loadingLabel='Creando cuenta...'>
          Crear cuenta y comenzar
        </AuthSubmitButton>
      </form>
    </AuthModalShell>
  );
}
