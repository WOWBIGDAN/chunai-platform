import { LogisticsProvider, LogisticsProviderError, logisticsConfig, parseTrackingResult, parseTrackingTime } from '../../src/commerce/logistics-provider';

const sample = (status = '1') => ({ status: '0', result: { number: 'SF123456789', type: 'sfexpress', deliverystatus: status,
  list: [{ time: '2026-01-02 12:30:00', status: '运输中' }, { time: '2026-01-01 09:00:00', status: '已揽收' }] } });
describe('Aliyun logistics adapter', () => {
  const original = { provider: process.env.LOGISTICS_PROVIDER, code: process.env.LOGISTICS_APPCODE };
  beforeEach(() => { process.env.LOGISTICS_PROVIDER = 'ALIYUN'; process.env.LOGISTICS_APPCODE = 'fakeAppCodeForTests123456'; });
  afterEach(() => {
    jest.restoreAllMocks();
    if (original.provider === undefined) delete process.env.LOGISTICS_PROVIDER; else process.env.LOGISTICS_PROVIDER = original.provider;
    if (original.code === undefined) delete process.env.LOGISTICS_APPCODE; else process.env.LOGISTICS_APPCODE = original.code;
  });
  it.each([['0', 'IN_TRANSIT'], ['1', 'IN_TRANSIT'], ['2', 'OUT_FOR_DELIVERY'], ['3', 'DELIVERED'], ['4', 'EXCEPTION'], ['5', 'EXCEPTION'], ['6', 'RETURNED']])('maps status %s to %s', (raw, expected) => {
    expect(parseTrackingResult(sample(raw), 'SF123456789', 'SFEXPRESS').status).toBe(expected);
  });
  it('parses China timestamps and rejects impossible/future dates', () => {
    expect(parseTrackingTime('2026-01-01 09:00:00').toISOString()).toBe('2026-01-01T01:00:00.000Z');
    for (const time of ['2026-02-30 10:00:00', '2026-01-01T09:00:00', '2099-01-01 00:00:00']) expect(() => parseTrackingTime(time)).toThrow(LogisticsProviderError);
  });
  it('rejects mismatched shipment, carrier, unknown status and malformed events', () => {
    for (const r of [{ ...sample(), result: { ...sample().result, number: 'OTHER' } },
      { ...sample(), result: { ...sample().result, type: 'zto' } }, sample('99'),
      { ...sample(), result: { ...sample().result, list: [{ time: '2026-01-01 00:00:00', status: '' }] } }]) {
      expect(() => parseTrackingResult(r, 'SF123456789', 'SFEXPRESS')).toThrow(LogisticsProviderError);
    }
  });
  it.each([['201', 'LOGISTICS_NUMBER_INVALID'], ['203', 'LOGISTICS_CARRIER_INVALID'], ['204', 'LOGISTICS_CARRIER_UNRECOGNIZED'],
    ['205', 'LOGISTICS_NO_DATA'], ['207', 'LOGISTICS_IP_RESTRICTED']])('sanitizes provider error %s', (status, code) => {
    expect(() => parseTrackingResult({ status, msg: 'secret provider diagnostics' }, 'SF123456789', 'SFEXPRESS')).toThrow(code);
  });
  it('uses fixed HTTPS endpoint, AppCode header and suffix only for required carriers', async () => {
    const mock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(sample())));
    await new LogisticsProvider().query('SF', 'SF123456789', '0123');
    const [url, options] = mock.mock.calls[0];
    expect(String(url)).toBe('https://wuliu.market.alicloudapi.com/kdi?type=SFEXPRESS&no=SF123456789%3A0123');
    expect(options?.headers).toEqual({ Authorization: 'APPCODE fakeAppCodeForTests123456', Accept: 'application/json' });
    expect(options?.redirect).toBe('error');
    mock.mockResolvedValue(new Response(JSON.stringify({ ...sample(), result: { ...sample().result, type: 'YTO' } })));
    await new LogisticsProvider().query('YTO', 'SF123456789', '0123');
    expect(String(mock.mock.calls[1][0])).not.toContain('0123');
  });
  it('requires phone suffix before sending a request', async () => {
    const mock = jest.spyOn(globalThis, 'fetch');
    await expect(new LogisticsProvider().query('ZTO', '12345678', null)).rejects.toThrow('LOGISTICS_PHONE_REQUIRED'); expect(mock).not.toHaveBeenCalled();
  });
  it.each([[401, 'LOGISTICS_AUTH_FAILED'], [403, 'LOGISTICS_ACCESS_DENIED'], [429, 'LOGISTICS_RATE_LIMITED'], [500, 'LOGISTICS_PROVIDER_UNAVAILABLE']])('sanitizes HTTP %s', async (status, code) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('upstream secret', { status: status as number }));
    await expect(new LogisticsProvider().query('SF', 'SF123456789', '0123')).rejects.toThrow(code as string);
  });
  it('sanitizes network failures and rejects invalid JSON and oversized responses', async () => {
    const mock = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Authorization: secret'));
    await expect(new LogisticsProvider().query('SF', 'SF123456789', '0123')).rejects.toThrow('LOGISTICS_PROVIDER_UNAVAILABLE');
    mock.mockRejectedValue(new DOMException('secret url', 'TimeoutError'));
    await expect(new LogisticsProvider().query('SF', 'SF123456789', '0123')).rejects.toThrow('LOGISTICS_TIMEOUT');
    for (const body of ['not-json', 'x'.repeat(1024 * 1024 + 1)]) {
      mock.mockResolvedValue(new Response(body));
      await expect(new LogisticsProvider().query('SF', 'SF123456789', '0123')).rejects.toThrow('LOGISTICS_PROVIDER_INVALID_RESPONSE');
    }
  });
  it('validates configuration and disables access without credentials', async () => {
    delete process.env.LOGISTICS_APPCODE; expect(() => logisticsConfig()).toThrow('LOGISTICS_APPCODE');
    process.env.LOGISTICS_PROVIDER = 'NONE';
    await expect(new LogisticsProvider().query('SF', 'SF123456789', '0123')).rejects.toThrow('LOGISTICS_NOT_CONFIGURED');
  });
});
