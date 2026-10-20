import type { ProblemDetailsException } from '@/api';

export type AuthFieldAliases = Readonly<Record<string, readonly string[]>>;

/**
 * Traduce `ProblemDetailsException.errors` al nombre del campo del formulario.
 * Usa `firstFieldError()` para mostrar un mensaje accionable por input.
 */
export function mapProblemToFieldErrors(
  problem: ProblemDetailsException,
  aliases: AuthFieldAliases,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const [formField, backendFields] of Object.entries(aliases)) {
    for (const backendField of backendFields) {
      const message = problem.firstFieldError(backendField);

      if (message) {
        fieldErrors[formField] = message;
        break;
      }
    }
  }

  return fieldErrors;
}

export function resolveAuthErrorMessage(problem: ProblemDetailsException): string {
  if (problem.isRateLimited) {
    return problem.retryAfterSeconds
      ? `Demasiados intentos. Espera ${problem.retryAfterSeconds}s e inténtalo de nuevo.`
      : 'Demasiados intentos. Espera unos segundos e inténtalo de nuevo.';
  }

  if (problem.isNetworkError) {
    return 'Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.';
  }

  if (problem.isTimeout) {
    return 'El servidor tardó demasiado en responder. Inténtalo de nuevo.';
  }

  return problem.detail ?? problem.title ?? 'No pudimos completar la operación.';
}
