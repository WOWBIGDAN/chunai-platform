import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../database/data-source';
import { PasswordService } from '../auth/password.service';
import { AdminAccount, AdminSession, AuditLog } from './entities';
import { PERMISSIONS } from './permissions';

async function passwordPrompt(): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Run in an interactive terminal; the password is never accepted in command arguments');
  process.stdout.write('Administrator password (hidden): ');
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', read); process.stdout.write('\n'); };
    const read = (chunk: string) => {
      for (const c of chunk) {
        if (c === '\u0003') { finish(); reject(new Error('Cancelled')); return; }
        if (c === '\r' || c === '\n') { finish(); resolve(value); return; }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else if (c >= ' ' && value.length < 72) value += c;
      }
    };
    process.stdin.on('data', read);
  });
}
async function main() {
  const [command, username, permissionCsv, displayName] = process.argv.slice(2);
  if (!['create', 'permissions', 'disable', 'reset-password'].includes(command) || !/^[A-Za-z0-9_.-]{1,64}$/.test(username ?? '')) {
    throw new Error('Usage: admin-cli create <username> <comma-separated-permissions> [display-name] | permissions <username> <permissions> | disable <username> | reset-password <username>');
  }
  const permissions = [...new Set((permissionCsv ?? '').split(',').filter(Boolean))];
  if (permissions.some(p => !(PERMISSIONS as readonly string[]).includes(p))) throw new Error('Unknown permission');
  if (command === 'create' && !permissions.length) throw new Error('Specify at least one permission explicitly');
  if (displayName && displayName.length > 64) throw new Error('Display name must be at most 64 characters');
  let passwordHash: string | undefined;
  if (command === 'create' || command === 'reset-password') {
    const secret = await passwordPrompt();
    if (secret.length < 12 || secret.length > 72) throw new Error('Use a password of 12–72 characters');
    passwordHash = await new PasswordService().hash(secret);
  }
  const db = new DataSource(databaseOptions()); await db.initialize();
  try {
    await db.transaction(async m => {
      let a = await m.findOne(AdminAccount, { where: { username }, lock: { mode: 'pessimistic_write' } });
      if (command === 'create') {
        if (a) throw new Error('Administrator already exists');
        a = m.create(AdminAccount, { id: randomUUID(), username, displayName: displayName ?? username, passwordHash: passwordHash!, permissions, enabled: true, version: 1 });
      } else {
        if (!a) throw new Error('Administrator does not exist');
        if (command === 'permissions') a.permissions = permissions;
        if (command === 'disable') a.enabled = false;
        if (command === 'reset-password') a.passwordHash = passwordHash!;
        a.version++; a.updatedAt = new Date();
        await m.update(AdminSession, { adminId: a.id }, { revokedAt: new Date() });
      }
      await m.save(a);
      await m.save(m.create(AuditLog, { id: randomUUID(), actorKey: 'system:admin-cli', action: `admin.${command}`, resourceId: a.id, details: { username, permissions: a.permissions } }));
    });
    console.log(`Administrator ${command} completed; credentials were not printed.`);
  } finally { await db.destroy(); }
}
if (require.main === module) main().catch(() => { console.error('Administrator operation failed. Check arguments, password requirements, database migration and account existence.'); process.exitCode = 1; });
