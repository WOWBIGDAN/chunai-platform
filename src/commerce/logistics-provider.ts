import { Injectable } from '@nestjs/common';
import { integerEnv } from '../config';
import { ApiException } from '../common/http';

// Public API codes are stable; provider-specific aliases stay inside this adapter.
export const CARRIERS: Record<string, { name: string; type: string; phoneRequired: boolean }> = {
  SF: { name: '顺丰速运', type: 'SFEXPRESS', phoneRequired: true },
  YTO: { name: '圆通速递', type: 'YTO', phoneRequired: false },
  ZTO: { name: '中通快递', type: 'ZTO', phoneRequired: true },
  STO: { name: '申通快递', type: 'STO', phoneRequired: false },
  YUNDA: { name: '韵达快递', type: 'YUNDA', phoneRequired: false },
  EMS: { name: '邮政速递物流', type: 'EMS', phoneRequired: false },
  CHINAPOST: { name: '邮政包裹', type: 'CHINAPOST', phoneRequired: false },
  JD: { name: '京东物流', type: 'JD', phoneRequired: false },
  JITU: { name: '极兔速递', type: 'JITU', phoneRequired: false },
  DEPPON: { name: '德邦快递', type: 'DEPPON', phoneRequired: false },
  HTKY: { name: '百世快递', type: 'HTKY', phoneRequired: false },
  ZJS: { name: '宅急送', type: 'ZJS', phoneRequired: false },
  FWSY: { name: '丰网速运', type: 'FWSY', phoneRequired: true },
  KYEXPRESS: { name: '跨越速运', type: 'KYEXPRESS', phoneRequired: true },
};
export function carrierName(code: string) {
  const carrier = Object.hasOwn(CARRIERS, code) ? CARRIERS[code] : undefined;
  if (!carrier) throw new ApiException(400, 'CARRIER_UNSUPPORTED', '不支持的快递代码');
  return carrier.name;
}
export function logisticsConfig() {
  const provider = process.env.LOGISTICS_PROVIDER ?? 'NONE';
  if (!['NONE', 'ALIYUN'].includes(provider)) throw new Error('Invalid LOGISTICS_PROVIDER');
  const appCode = process.env.LOGISTICS_APPCODE ?? '';
  if (provider === 'ALIYUN' && !/^[A-Za-z0-9]{16,128}$/.test(appCode)) throw new Error('LOGISTICS_APPCODE is required for ALIYUN');
  return { enabled: provider === 'ALIYUN', appCode,
    timeoutMs: integerEnv('LOGISTICS_TIMEOUT_MS', 8000, 1000, 15000),
    intervalSeconds: integerEnv('LOGISTICS_SYNC_INTERVAL_SECONDS', 1800, 300, 86400),
    maxDays: integerEnv('LOGISTICS_AUTO_SYNC_DAYS', 30, 1, 90),
    batchSize: integerEnv('LOGISTICS_SYNC_BATCH_SIZE', 10, 1, 50) };
}
export type TrackingStatus = 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'EXCEPTION' | 'RETURNED';
export interface TrackingResult { status: TrackingStatus; events: { time: Date; description: string }[] }
export class LogisticsProviderError extends Error {
  constructor(public readonly code: string) { super(code); }
}
const fail = (code = 'LOGISTICS_PROVIDER_INVALID_RESPONSE'): never => { throw new LogisticsProviderError(code); };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// Provider timestamps are China local time, regardless of the server's timezone.
export function parseTrackingTime(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return fail();
  const time = new Date(value.replace(' ', 'T') + '+08:00');
  if (!Number.isFinite(time.getTime()) || time.getTime() > Date.now() + 300000 ||
      new Date(time.getTime() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) return fail();
  return time;
}
export function parseTrackingResult(raw: unknown, trackingNo: string, carrierType: string): TrackingResult {
  if (!record(raw)) return fail();
  const code = String(raw.status);
  const errors: Record<string, string> = { '201': 'LOGISTICS_NUMBER_INVALID', '203': 'LOGISTICS_CARRIER_INVALID',
    '204': 'LOGISTICS_CARRIER_UNRECOGNIZED', '205': 'LOGISTICS_NO_DATA', '207': 'LOGISTICS_IP_RESTRICTED' };
  if (code !== '0') return fail(errors[code] ?? 'LOGISTICS_PROVIDER_UNAVAILABLE');
  const r = raw.result;
  if (!record(r) || typeof r.number !== 'string' || r.number.split(':')[0] !== trackingNo ||
      typeof r.type !== 'string' || r.type.toUpperCase() !== carrierType.toUpperCase() ||
      !Array.isArray(r.list) || r.list.length > 2000) return fail();
  const states: Record<string, TrackingStatus> = { '0': 'IN_TRANSIT', '1': 'IN_TRANSIT', '2': 'OUT_FOR_DELIVERY',
    '3': 'DELIVERED', '4': 'EXCEPTION', '5': 'EXCEPTION', '6': 'RETURNED' };
  const status = states[String(r.deliverystatus)];
  if (!status) return fail();
  if (!r.list.length) return fail('LOGISTICS_NO_DATA');
  const events = r.list.map(e => {
    if (!record(e) || typeof e.status !== 'string' || !e.status.trim() || e.status.length > 500) return fail();
    return { time: parseTrackingTime(e.time), description: e.status.trim() };
  }).sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 200);
  return { status, events };
}

@Injectable()
export class LogisticsProvider {
  constructor() { logisticsConfig(); }
  async query(carrierCode: string, trackingNo: string, phoneLast4: string | null): Promise<TrackingResult> {
    const config = logisticsConfig();
    if (!config.enabled) return fail('LOGISTICS_NOT_CONFIGURED');
    carrierName(carrierCode);
    const carrier = CARRIERS[carrierCode];
    if (carrier.phoneRequired && (!phoneLast4 || !/^\d{4}$/.test(phoneLast4))) return fail('LOGISTICS_PHONE_REQUIRED');
    const url = new URL('https://wuliu.market.alicloudapi.com/kdi');
    url.searchParams.set('type', carrier.type);
    url.searchParams.set('no', trackingNo + (carrier.phoneRequired ? `:${phoneLast4}` : ''));
    try {
      const response = await fetch(url, { headers: { Authorization: `APPCODE ${config.appCode}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(config.timeoutMs), redirect: 'error' });
      if (!response.ok) {
        await response.body?.cancel();
        return fail(response.status === 401 ? 'LOGISTICS_AUTH_FAILED' : response.status === 403 ? 'LOGISTICS_ACCESS_DENIED' :
          response.status === 429 ? 'LOGISTICS_RATE_LIMITED' : 'LOGISTICS_PROVIDER_UNAVAILABLE');
      }
      if (!response.body) return fail();
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > 1024 * 1024) { await reader.cancel(); return fail(); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      let raw: unknown;
      try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return fail(); }
      return parseTrackingResult(raw, trackingNo, carrier.type);
    } catch (error) {
      if (error instanceof LogisticsProviderError) throw error;
      // Never propagate upstream URLs, headers, raw messages or credentials.
      return fail(record(error) && ['TimeoutError', 'AbortError'].includes(String(error.name)) ? 'LOGISTICS_TIMEOUT' : 'LOGISTICS_PROVIDER_UNAVAILABLE');
    }
  }
}
