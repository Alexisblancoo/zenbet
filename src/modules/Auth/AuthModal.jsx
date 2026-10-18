import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Lock, Mail, User, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import apiClient from '@/services/apiClient';

export default function AuthModal({ isOpen, onClose, initialMode = 'register', onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'register' | 'login'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const isRegister = mode === 'register';

  // Validación de formulario
  const isFormValid = isRegister
    ? username.trim().length >= 3 &&
      email.trim().includes('@') &&
      password.length >= 6 &&
      password === confirmPassword &&
      termsAccepted
    : email.trim().length > 0 && password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (isRegister) {
        if (!termsAccepted) {
          setErrorMessage('Debe aceptar obligatoriamente los Términos y Condiciones y la Política de Privacidad.');
          setIsLoading(false);
          return;
        }

        const data = await apiClient.post('/auth/register', {
          username: username.trim(),
          email: email.trim(),
          password,
          initialBalance: 1000.00,
          termsAccepted: true,
        });

        if (data.token) {
          localStorage.setItem('zenbet_token', data.token);
          if (data.user) {
            localStorage.setItem('zenbet_user', JSON.stringify(data.user));
          }
        }

        setSuccessMessage('¡Registro exitoso! Iniciando terminal...');
        setTimeout(() => {
          onAuthSuccess?.(data.user);
          onClose();
        }, 800);
      } else {
        const data = await apiClient.post('/auth/login', {
          identifier: email.trim(),
          password,
        });

        if (data.token) {
          localStorage.setItem('zenbet_token', data.token);
          if (data.user) {
            localStorage.setItem('zenbet_user', JSON.stringify(data.user));
          }
        }

        setSuccessMessage('¡Sesión iniciada con éxito!');
        setTimeout(() => {
          onAuthSuccess?.(data.user);
          onClose();
        }, 800);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error al conectar con la API de autenticación.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='auth-modal-title'
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'
    >
      <div className='relative w-full max-w-md border border-obsidian-border bg-obsidian-surface p-6 sm:p-8 shadow-2xl'>
        {/* Botón cerrar */}
        <button
          type='button'
          onClick={onClose}
          aria-label='Cerrar modal de autenticación'
          className='absolute right-4 top-4 border border-transparent p-1.5 text-metallic-slate transition-colors hover:border-obsidian-border hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson'
        >
          <X size={18} aria-hidden='true' />
        </button>

        {/* Pestañas de modo */}
        <div className='mb-6 flex border-b border-obsidian-border'>
          <button
            type='button'
            onClick={() => {
              setMode('register');
              setErrorMessage('');
            }}
            className={`flex-1 pb-3 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
              isRegister
                ? 'border-b-2 border-crimson text-white'
                : 'text-metallic-titanium hover:text-white'
            }`}
          >
            Registro de Cuenta
          </button>
          <button
            type='button'
            onClick={() => {
              setMode('login');
              setErrorMessage('');
            }}
            className={`flex-1 pb-3 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
              !isRegister
                ? 'border-b-2 border-crimson text-white'
                : 'text-metallic-titanium hover:text-white'
            }`}
          >
            Iniciar Sesión
          </button>
        </div>

        <h2 id='auth-modal-title' className='font-display text-xl font-black uppercase text-white'>
          {isRegister ? 'Crear Nueva Cuenta' : 'Acceso a la Terminal'}
        </h2>
        <p className='mt-1 text-xs text-metallic-slate'>
          {isRegister
            ? 'Regístrate para operar con cuotas en vivo y liquidación atómica.'
            : 'Ingresa tus credenciales seguras para acceder a tu balance.'}
        </p>

        {errorMessage && (
          <div
            role='alert'
            className='mt-4 flex items-start gap-2 border border-crimson/50 bg-crimson/10 p-3 text-xs text-crimson-200'
          >
            <AlertCircle size={15} className='mt-0.5 shrink-0 text-crimson' aria-hidden='true' />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            role='status'
            className='mt-4 flex items-start gap-2 border border-emerald-500/50 bg-emerald-500/10 p-3 text-xs text-emerald-300'
          >
            <ShieldCheck size={15} className='mt-0.5 shrink-0 text-emerald-400' aria-hidden='true' />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className='mt-6 space-y-4'>
          {isRegister && (
            <div>
              <label
                htmlFor='reg-username'
                className='block font-mono text-[11px] font-bold uppercase tracking-wider text-metallic-titanium mb-1.5'
              >
                Nombre de Usuario
              </label>
              <div className='relative'>
                <User size={15} className='absolute left-3 top-3 text-metallic-slate pointer-events-none' aria-hidden='true' />
                <input
                  id='reg-username'
                  type='text'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder='trader_elite'
                  required
                  aria-required='true'
                  className='w-full border border-obsidian-border bg-obsidian-void py-2.5 pl-9 pr-3 font-sans text-sm text-white placeholder:text-metallic-slate focus:border-crimson focus:outline-none focus:ring-1 focus:ring-crimson'
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor='reg-email'
              className='block font-mono text-[11px] font-bold uppercase tracking-wider text-metallic-titanium mb-1.5'
            >
              {isRegister ? 'Correo Electrónico' : 'Email o Nombre de Usuario'}
            </label>
            <div className='relative'>
              <Mail size={15} className='absolute left-3 top-3 text-metallic-slate pointer-events-none' aria-hidden='true' />
              <input
                id='reg-email'
                type={isRegister ? 'email' : 'text'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? 'usuario@ejemplo.com' : 'usuario@ejemplo.com o trader_zenbet'}
                required
                aria-required='true'
                className='w-full border border-obsidian-border bg-obsidian-void py-2.5 pl-9 pr-3 font-sans text-sm text-white placeholder:text-metallic-slate focus:border-crimson focus:outline-none focus:ring-1 focus:ring-crimson'
              />
            </div>
          </div>

          <div>
            <label
              htmlFor='reg-password'
              className='block font-mono text-[11px] font-bold uppercase tracking-wider text-metallic-titanium mb-1.5'
            >
              Contraseña
            </label>
            <div className='relative'>
              <Lock size={15} className='absolute left-3 top-3 text-metallic-slate pointer-events-none' aria-hidden='true' />
              <input
                id='reg-password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='••••••••'
                required
                minLength={6}
                aria-required='true'
                className='w-full border border-obsidian-border bg-obsidian-void py-2.5 pl-9 pr-3 font-sans text-sm text-white placeholder:text-metallic-slate focus:border-crimson focus:outline-none focus:ring-1 focus:ring-crimson'
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label
                htmlFor='reg-confirm-password'
                className='block font-mono text-[11px] font-bold uppercase tracking-wider text-metallic-titanium mb-1.5'
              >
                Confirmar Contraseña
              </label>
              <div className='relative'>
                <Lock size={15} className='absolute left-3 top-3 text-metallic-slate pointer-events-none' aria-hidden='true' />
                <input
                  id='reg-confirm-password'
                  type='password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder='••••••••'
                  required
                  aria-required='true'
                  className='w-full border border-obsidian-border bg-obsidian-void py-2.5 pl-9 pr-3 font-sans text-sm text-white placeholder:text-metallic-slate focus:border-crimson focus:outline-none focus:ring-1 focus:ring-crimson'
                />
              </div>
            </div>
          )}

          {/* CHECKBOX OBLIGATORIO DE CONSENTIMIENTO */}
          {isRegister && (
            <div className='pt-2'>
              <label
                htmlFor='auth-terms-consent'
                className='flex items-start gap-2.5 cursor-pointer text-xs select-none'
              >
                <input
                  id='auth-terms-consent'
                  type='checkbox'
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  aria-required='true'
                  aria-label='Acepto los Términos y Condiciones y la Política de Privacidad'
                  className='mt-0.5 h-4 w-4 rounded border-obsidian-border bg-obsidian-void text-crimson focus:ring-crimson cursor-pointer'
                />
                <span className='text-metallic-slate leading-tight'>
                  Acepto los{' '}
                  <Link
                    to='/terms'
                    onClick={onClose}
                    className='text-metallic-platinum underline hover:text-crimson'
                  >
                    Términos y Condiciones
                  </Link>{' '}
                  y la{' '}
                  <Link
                    to='/privacy'
                    onClick={onClose}
                    className='text-metallic-platinum underline hover:text-crimson'
                  >
                    Política de Privacidad
                  </Link>.
                </span>
              </label>
            </div>
          )}

          {/* BOTÓN DE ENVÍO - DESHABILITADO HASTA QUE SE MARQUE EL CHECKBOX Y EL FORM SEA VÁLIDO */}
          <button
            type='submit'
            disabled={!isFormValid || isLoading}
            aria-busy={isLoading}
            className={`w-full py-3 px-4 font-display text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 ${
              !isFormValid || isLoading
                ? 'cursor-not-allowed border border-obsidian-border bg-obsidian-elevated text-metallic-slate'
                : 'border-brutal-crimson bg-crimson text-white shadow-brutal-crimson hover:bg-crimson-pure active:translate-x-0.5 active:translate-y-0.5'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className='animate-spin' aria-hidden='true' />
                <span>Procesando solicitud...</span>
              </>
            ) : isRegister ? (
              'Crear Cuenta y Comenzar'
            ) : (
              'Entrar a la Terminal'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
