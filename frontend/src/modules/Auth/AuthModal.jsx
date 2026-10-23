import { useState } from 'react';
import LoginModal from './LoginModal';
import RegisterModal from './RegisterModal';

/**
 * @deprecated Usa `LoginModal` o `RegisterModal` directamente.
 * Se conserva como adaptador para llamadas existentes.
 */
export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'register',
  onAuthSuccess,
}) {
  const [mode, setMode] = useState(initialMode);
  const [syncedInitialMode, setSyncedInitialMode] = useState(initialMode);

  // Ajuste en render (sin efecto): si el consumidor cambia `initialMode`, remonta el modo.
  if (initialMode !== syncedInitialMode) {
    setSyncedInitialMode(initialMode);
    setMode(initialMode);
  }

  if (!isOpen) return null;

  const handleSuccess = (authenticatedUser) => {
    onAuthSuccess?.(authenticatedUser);
    onClose();
  };

  if (mode === 'login') {
    return (
      <LoginModal
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={handleSuccess}
        onSwitchToRegister={() => setMode('register')}
      />
    );
  }

  return (
    <RegisterModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={handleSuccess}
      onSwitchToLogin={() => setMode('login')}
    />
  );
}
