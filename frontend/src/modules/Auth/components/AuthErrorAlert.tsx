import { AlertCircle } from 'lucide-react';

interface AuthErrorAlertProps {
  readonly message: string;
}

export default function AuthErrorAlert({ message }: AuthErrorAlertProps) {
  if (!message) return null;

  return (
    <div
      role='alert'
      className='flex items-start gap-2 rounded-md border border-odds-down/40 bg-odds-down/10 p-3 text-xs leading-relaxed text-odds-down'
    >
      <AlertCircle size={14} className='mt-0.5 shrink-0' aria-hidden='true' />
      <span>{message}</span>
    </div>
  );
}
