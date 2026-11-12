import { describe, expect, it } from 'vitest';

import {
  ADMIN_DEPOSITS_ENDPOINT,
  adminDepositApprovePath,
} from '@/services/adminDepositService';

describe('adminDepositApprovePath', () => {
  it('usa el endpoint canónico de administración', () => {
    expect(ADMIN_DEPOSITS_ENDPOINT).toBe('/admin/depósitos');
    expect(adminDepositApprovePath('dep-1')).toBe('/admin/depósitos/dep-1/aprobar');
  });

  it('codifica el id para no romper la ruta', () => {
    expect(adminDepositApprovePath('a/b')).toBe('/admin/depósitos/a%2Fb/aprobar');
  });
});
