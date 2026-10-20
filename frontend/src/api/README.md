# Zenbet / Capa HTTP

Base de comunicación entre React y la Web API .NET 10. Aísla Axios, el JWT, la
idempotencia y los errores RFC 7807 para que la UI solo consuma contratos.

## Regla de dependencias

```text
contracts.ts        Tipos RFC 7807 y respuestas paginadas
   ↑        ↑
errors.ts   authToken.ts / idempotency.ts
   ↑        ↑
        client.ts   Único módulo que importa Axios
             ↑
          index.ts  API pública (importar siempre desde '@/api')
```

## Uso

```ts
import {
  apiClient,
  ProblemDetailsException,
  createIdempotencyKey,
} from '@/api';

const idempotencyKey = createIdempotencyKey();

try {
  const bet = await apiClient.post<PlaceBetResponse, PlaceBetRequest>(
    '/bets',
    payload,
    { headers: { 'X-Idempotency-Key': idempotencyKey } },
  );
} catch (error) {
  if (error instanceof ProblemDetailsException) {
    if (error.isRateLimited) {
      // error.retryAfterSeconds / error.retryAt
    }

    const amountError = error.firstFieldError('amount');
    if (amountError) showValidationMessage(amountError);
  }
}
```

`apiClient` devuelve el cuerpo (`T`), no un `AxiosResponse`. Para casos
avanzados, `http` expone la instancia de Axios ya configurada.

## Contrato de error

Todo rechazo (incluidos timeout y caída de red) se convierte en
`ProblemDetailsException` con:

| Campo | Uso en UI |
| --- | --- |
| `status` / `code` | Bifurcación de mensajes |
| `title` / `detail` | Mensaje visible |
| `errors` / `fieldErrors` | Errores por campo (400/422) |
| `traceId` | Soporte y observabilidad |
| `retryAfterSeconds` / `retryAt` | Countdown en 429 |
| `isNetworkError`, `isTimeout`, `isCanceled` | Estados no bloqueantes |

## JWT e idempotencia

- `authToken` mantiene el JWT en memoria y lo sincroniza con
  `localStorage['zenbet_token']`. No escribir esa clave desde componentes.
- El interceptor de solicitudes inyecta `Authorization: Bearer <token>`.
- Los métodos `POST`, `PUT` y `PATCH` reciben `X-Idempotency-Key` con UUID v4
  salvo que el llamador provea uno (útil para reintentos).
- Un `401` con sesión activa limpia el token y emite
  `zenbet:auth-unauthorized`; el router decide la redirección.

## Variables de entorno

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:5000/api/v1
```

`VITE_API_BASE_URL` se acepta como fallback de migración.
