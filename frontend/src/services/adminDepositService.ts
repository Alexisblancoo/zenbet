/**
 * Cola de aprobación de depósitos (solo admin).
 *
 * Contrato real:
 * - `GET  /api/v1/admin/depósitos/pendientes`
 * - `POST /api/v1/admin/depósitos/{id}/aprobar`
 *
 * El servidor decide: un jugador recibe 403, un depósito inexistente 404 y
 * aprobar el depósito propio 403 (`SelfApprovalForbidden`). La UI no inventa
 * estados ni importes: si la respuesta no respeta el contrato, se rechaza.
 */

import { apiClient } from '@/api';

export const ADMIN_DEPOSITS_ENDPOINT = '/admin/depósitos';

export interface AdminPendingDeposit {
  readonly id: string;
  readonly walletId: string;
  readonly userId: string;
  readonly username: string;
  readonly email: string;
  readonly amount: number;
  readonly method: string;
  readonly reference: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface ApproveDepositResult {
  readonly transactionId: string;
  readonly status: string;
  readonly alreadyApproved: boolean;
  readonly newBalance: number;
}

export class AdminDepositContractError extends Error {
  constructor(detail: string) {
    super(`Respuesta inesperada de la cola de depósitos (${detail}).`);
    this.name = 'AdminDepositContractError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AdminDepositContractError(field);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AdminDepositContractError(field);
  }
  return value;
}

function requireIso(value: unknown, field: string): string {
  const candidate = requireString(value, field);
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) throw new AdminDepositContractError(field);
  return date.toISOString();
}

function toPendingDeposit(value: unknown): AdminPendingDeposit {
  if (!isRecord(value)) throw new AdminDepositContractError('item');

  return {
    id: requireString(value.id, 'deposit.id'),
    walletId: requireString(value.walletId, 'deposit.walletId'),
    userId: requireString(value.userId, 'deposit.userId'),
    username: requireString(value.username, 'deposit.username'),
    email: requireString(value.email, 'deposit.email'),
    amount: requireNumber(value.amount, 'deposit.amount'),
    method: requireString(value.method, 'deposit.method'),
    reference: typeof value.reference === 'string' ? value.reference : '',
    status: requireString(value.status, 'deposit.status'),
    createdAt: requireIso(value.createdAt, 'deposit.createdAt'),
  };
}

export function adminDepositApprovePath(id: string): string {
  return `${ADMIN_DEPOSITS_ENDPOINT}/${encodeURIComponent(id)}/aprobar`;
}

export async function listPendingDeposits(
  signal?: AbortSignal,
): Promise<readonly AdminPendingDeposit[]> {
  const wire = await apiClient.get<readonly unknown[]>(`${ADMIN_DEPOSITS_ENDPOINT}/pendientes`, {
    signal,
  });

  if (!Array.isArray(wire)) throw new AdminDepositContractError('pendientes');

  return wire.map(toPendingDeposit);
}

export async function approveDeposit(id: string): Promise<ApproveDepositResult> {
  const wire = await apiClient.post<Record<string, unknown>>(adminDepositApprovePath(id), {});

  if (!isRecord(wire)) throw new AdminDepositContractError('aprobar');

  return {
    transactionId: requireString(wire.transactionId, 'approve.transactionId'),
    status: requireString(wire.status, 'approve.status'),
    alreadyApproved: Boolean(wire.alreadyApproved),
    newBalance: requireNumber(wire.newBalance, 'approve.newBalance'),
  };
}
