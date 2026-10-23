import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';

const OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PREFIX = 'scrypt$32768$8$1';

@Injectable()
export class PasswordService {
  // A missing account still incurs the same password derivation work.
  private readonly dummy = `${PREFIX}$${Buffer.alloc(16).toString('hex')}$${scryptSync('dummy-password', Buffer.alloc(16), 64, OPTIONS).toString('hex')}`;

  private derive(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(password, salt, 64, OPTIONS, (error, result) => error ? reject(error) : resolve(result));
    });
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await this.derive(password, salt);
    return `${PREFIX}$${salt.toString('hex')}$${key.toString('hex')}`;
  }

  async verify(password: string, hash?: string): Promise<boolean> {
    const encoded = hash ?? this.dummy;
    const match = /^scrypt\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
    if (!match) {
      await this.verify(password);
      return false;
    }
    const key = await this.derive(password, Buffer.from(match[1], 'hex'));
    return timingSafeEqual(key, Buffer.from(match[2], 'hex')) && hash !== undefined;
  }
}
