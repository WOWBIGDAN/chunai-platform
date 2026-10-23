import 'dotenv/config';

export function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return Number(raw);
}

export function authConfig() {
  const secret = process.env.JWT_SECRET ?? '';
  if (Buffer.byteLength(secret) < 32 || secret.startsWith('replace-with-')) {
    throw new Error('JWT_SECRET must be configured with a random secret of at least 32 bytes');
  }
  const termsHtml = process.env.TERMS_HTML ?? '<p>开发环境用户协议占位</p>';
  const privacyHtml = process.env.PRIVACY_HTML ?? '<p>开发环境隐私政策占位</p>';
  if (process.env.NODE_ENV === 'production' &&
      (!process.env.TERMS_HTML || !process.env.PRIVACY_HTML || /占位/.test(termsHtml + privacyHtml))) {
    throw new Error('Production requires approved TERMS_HTML and PRIVACY_HTML');
  }
  const termsVersion = process.env.TERMS_VERSION ?? '2026-10-01';
  const privacyVersion = process.env.PRIVACY_VERSION ?? '2026-10-01';
  for (const version of [termsVersion, privacyVersion]) {
    if (!version.trim() || version.length > 64) throw new Error('Invalid legal document version');
  }
  const legalUpdatedAt = new Date(process.env.LEGAL_UPDATED_AT ?? '2026-10-01T00:00:00.000Z');
  if (!Number.isFinite(legalUpdatedAt.getTime())) throw new Error('Invalid LEGAL_UPDATED_AT');
  return {
    secret,
    issuer: process.env.JWT_ISSUER ?? 'chunai-platform',
    accessTtl: integerEnv('ACCESS_TOKEN_TTL_SECONDS', 900, 60, 3600),
    refreshDays: integerEnv('REFRESH_TOKEN_TTL_DAYS', 30, 1, 30),
    termsVersion, privacyVersion, termsHtml, privacyHtml,
    legalUpdatedAt: legalUpdatedAt.toISOString(),
  };
}
