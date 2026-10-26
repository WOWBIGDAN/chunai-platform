export const PERMISSIONS = ['content:write', 'membership:write', 'users:read', 'users:ban', 'products:write', 'orders:read', 'orders:ship',
  'aftersales:review', 'payments:test', 'audit:read'] as const;
export type Permission = typeof PERMISSIONS[number];

export function testPaymentsEnabled() {
  return process.env.COMMERCE_TEST_PAYMENTS === 'true' &&
    ['development', 'test', 'staging'].includes(process.env.NODE_ENV ?? 'development');
}
