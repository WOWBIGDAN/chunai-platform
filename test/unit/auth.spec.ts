import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../../src/auth/auth.dto';
import { PasswordService } from '../../src/auth/password.service';
import { authConfig } from '../../src/config';

describe('password security', () => {
  const passwords = new PasswordService();

  it('salts identical passwords and verifies without storing plaintext', async () => {
    const plaintext = '测试密码Example#Password9';
    const [first, second] = await Promise.all([passwords.hash(plaintext), passwords.hash(plaintext)]);
    expect(first).not.toBe(second);
    expect(first).not.toContain(plaintext);
    expect(await passwords.verify(plaintext, first)).toBe(true);
    expect(await passwords.verify('wrong-password', first)).toBe(false);
    expect(await passwords.verify('dummy-password')).toBe(false);
    expect(await passwords.verify(plaintext, 'malformed')).toBe(false);
  });

  it('does not truncate multibyte passwords at 72 bytes', async () => {
    const prefix = '密'.repeat(30);
    const encoded = await passwords.hash(`${prefix}A`);
    expect(await passwords.verify(`${prefix}A`, encoded)).toBe(true);
    expect(await passwords.verify(`${prefix}B`, encoded)).toBe(false);
  });
});

describe('register contract', () => {
  const valid = {
    phone: '+8613800000000', password: 'Example#Password9',
    termsVersion: '2026-10-01', privacyVersion: '2026-10-01',
  };
  const check = (value: object) => validate(plainToInstance(RegisterDto, value), {
    whitelist: true, forbidNonWhitelisted: true,
  });

  it('accepts registration without SMS fields', async () => { expect(await check(valid)).toHaveLength(0); });
  it.each([
    { role: 'admin' }, { status: 'ACTIVE' }, { smsCode: '123456' }, { challengeId: 'anything' },
    { password: 'short' }, { phone: 13800000000 }, { nickname: null }, { nickname: '   ' },
  ])('rejects invalid or privileged fields %j', async (patch) => {
    expect((await check({ ...valid, ...patch })).length).toBeGreaterThan(0);
  });
});

describe('configuration', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });
  it('rejects placeholder JWT keys', () => {
    process.env.JWT_SECRET = 'replace-with-a-random-secret-at-least-32-characters';
    expect(() => authConfig()).toThrow('JWT_SECRET');
  });
  it('rejects placeholder agreements in production', () => {
    process.env.JWT_SECRET = 'a'.repeat(64);
    process.env.NODE_ENV = 'production';
    delete process.env.TERMS_HTML;
    delete process.env.PRIVACY_HTML;
    expect(() => authConfig()).toThrow('Production requires');
  });
});
