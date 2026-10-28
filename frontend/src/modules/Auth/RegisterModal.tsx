import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, User } from 'lucide-react';

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
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,24}$/;

const FIELD_ALIASES: AuthFieldAliases = {
  username: ['username', 'Username'],
  email: ['email', 'Email'],
  password: ['password', 'Password'],
  termsAccepted: ['termsAccepted', 'TermsAccepted', 'terms'],
};

type FieldName = 'username' | 'email' | 'password' | 'confirmPassword' | 'termsAccepted';
type TouchedFields = Partial<Record<FieldName, boolean>>;

interface RegisterModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (user: AuthUser) => void;
  readonly onSwitchToLogin?: () => void;
  readonly variant?: 'modal' | 'page';
}

function buildLocalErrors(input: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};

  if (!USERNAME_PATTERN.test(input.username.trim())) {
    errors.username = 'Usa entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.';
  }

  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  if (input.password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.';
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Repite tu contraseña.';
  } else if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }

  if (!input.termsAccepted) {
    errors.termsAccepted =
      'Debes aceptar los términos y confirmar que eres mayor de 18 años.';
  }

  return errors;
}

export default function RegisterModal({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToLogin,
  variant = 'modal',
}: RegisterModalProps) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [touched, setTouched] = useState<TouchedFields>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usernameValid = USERNAME_PATTERN.test(username.trim());
  const emailValid = EMAIL_PATTERN.test(email.trim());
  const passwordValid = password.length >= 8;
  const confirmValid = Boolean(confirmPassword) && confirmPassword === password;

  const localErrors = buildLocalErrors({
    username,
    email,
    password,
    confirmPassword,
    termsAccepted,
  });

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
      setTouched({
        username: true,
        email: true,
        password: true,
        confirmPassword: true,
        termsAccepted: true,
      });
      setServerErrors({});
      setFormError('');
      return;
    }

    setServerErrors({});
    setFormError('');
    setIsSubmitting(true);

    try {
      const payload: RegisterPayload = {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        termsAccepted: true,
      };

      const authenticatedUser = await register(payload);

      setPassword('');
      setConfirmPassword('');
      setTermsAccepted(false);
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
    setConfirmPassword('');
    setTermsAccepted(false);
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
      eyebrow='Nueva cuenta · +18'
      title='Crear cuenta'
      description='Crea tu perfil y recarga saldo cuando quieras para apostar en las próximas carteleras UFC.'
      footer={
        <p className='text-center text-xs text-metallic-slate'>
          ¿Ya tienes cuenta?{' '}
          <button
            type='button'
            onClick={onSwitchToLogin}
            className='focus-ring font-semibold text-crimson transition-colors hover:text-crimson-200'
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
          onBlur={() => touchField('username')}
          placeholder='shibuya_ryo'
          autoComplete='username'
          error={fieldError('username')}
          valid={usernameValid}
          successMessage='Formato válido.'
          hint='Entre 3 y 24 caracteres.'
        />

        <AuthField
          id='register-email'
          label='Correo electrónico'
          icon={Mail}
          type='email'
          inputMode='email'
          value={email}
          onChange={(value) => {
            setEmail(value);
            clearFieldError('email');
          }}
          onBlur={() => touchField('email')}
          placeholder='tu@correo.com'
          autoComplete='email'
          error={fieldError('email')}
          valid={emailValid}
          successMessage='Correo válido.'
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
            onBlur={() => touchField('password')}
            placeholder='Mínimo 8 caracteres'
            autoComplete='new-password'
            error={fieldError('password')}
            valid={passwordValid}
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
          onBlur={() => touchField('confirmPassword')}
          placeholder='Repite tu contraseña'
          autoComplete='new-password'
          error={fieldError('confirmPassword')}
          valid={confirmValid}
          successMessage='Las contraseñas coinciden.'
        />

        <div className='space-y-1.5'>
          <label
            className={`flex cursor-pointer items-start gap-3 border p-3.5 transition-colors duration-150 ${
              termsAccepted
                ? 'border-money/40 bg-money/[0.035]'
                : fieldError('termsAccepted')
                  ? 'border-crimson/55 bg-crimson/[0.03]'
                  : 'border-white/[0.13] bg-white/[0.025] hover:border-white/[0.22]'
            }`}
          >
            <input
              type='checkbox'
              checked={termsAccepted}
              onChange={(event) => {
                setTermsAccepted(event.target.checked);
                clearFieldError('termsAccepted');
              }}
              onBlur={() => touchField('termsAccepted')}
              aria-invalid={Boolean(fieldError('termsAccepted'))}
              aria-required='true'
              className='focus-ring mt-0.5 h-4 w-4 shrink-0 cursor-pointer border-white/30 bg-transparent accent-money'
            />
            <span className='text-[11px] leading-relaxed text-metallic-titanium'>
              <span className='mr-1 inline-flex border border-crimson/40 bg-crimson/10 px-1 py-0.5 font-mono text-[8px] font-bold tracking-wide text-crimson'>
                +18
              </span>
              Acepto los{' '}
              <Link
                to='/terms'
                target='_blank'
                rel='noreferrer'
                className='font-semibold text-white underline decoration-white/30 underline-offset-2 transition-colors hover:text-crimson'
              >
                Términos y Condiciones
              </Link>{' '}
              y la{' '}
              <Link
                to='/privacy'
                target='_blank'
                rel='noreferrer'
                className='font-semibold text-white underline decoration-white/30 underline-offset-2 transition-colors hover:text-crimson'
              >
                Política de Privacidad
              </Link>
              . Confirmo que soy mayor de edad.
            </span>
          </label>

          {fieldError('termsAccepted') ? (
            <p role='alert' className='text-[11px] font-medium leading-relaxed text-crimson'>
              {fieldError('termsAccepted')}
            </p>
          ) : null}
        </div>

        <AuthSubmitButton isSubmitting={isSubmitting} loadingLabel='Creando cuenta...'>
          <span>Crear cuenta</span>
          <ArrowRight size={14} aria-hidden='true' />
        </AuthSubmitButton>
      </form>
    </AuthModalShell>
  );
}
