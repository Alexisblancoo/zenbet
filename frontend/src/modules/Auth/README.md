# Autenticación — Fase 2

## Capas

| Capa | Archivo | Responsabilidad |
| --- | --- | --- |
| Dominio | `src/domain/auth.ts` | Entidades `AuthUser`, `LoginCredentials`, `RegisterPayload`, `AuthSession` + normalización legacy (`balance` → `walletBalance`). |
| Casos de uso | `src/services/authService.ts` | `POST /auth/login` y `POST /auth/register`; valida token/usuario y devuelve `AuthSession`. |
| Infraestructura | `src/services/sessionPersistence.ts` | Lectura/escritura de `localStorage['zenbet_user']` con `normalizeAuthUser`. |
| Estado | `src/context/AuthContext.tsx` | `AuthProvider`: `user`, `isAuthenticated`, `isLoading`, `login`, `register`, `logout`. |
| Contrato | `src/context/authState.ts` | `useAuth()`, `AuthContext`, `BALANCE_UPDATED_EVENT`. |

## Eventos de la capa HTTP

- `zenbet:auth-token-changed` → si el token queda vacío (logout, expiración, 401), el provider limpia usuario y storage.
- `zenbet:auth-unauthorized` → 401 con sesión activa: cierra sesión; el router decide (las páginas `/login|/register` redirigen).
- `zenbet_balance_updated` → `MmaEventsPage` lo emite tras una apuesta; el provider sincroniza `walletBalance` y persiste.

## Endpoint de auth

Por defecto: `VITE_API_URL` + `/auth/*` (p. ej. `http://localhost:5000/api/v1/auth/login`).

Mientras la Web API nueva no exponga `/api/v1/auth/*`, se puede apuntar solo auth a la API legacy:

```dotenv
VITE_AUTH_URL=http://localhost:5000/api
```

`authService` pasa ese `baseURL` por request; el resto de la app sigue usando `VITE_API_URL`.
