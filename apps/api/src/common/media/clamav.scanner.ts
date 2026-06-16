import { Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const log = new Logger('ClamAvScanner');

export type ClamAvConfig = {
  enabled: boolean;
  binary: string;
};

export class ClamAvUnavailableError extends Error {
  constructor(message = 'Scan antivirus indisponible.') {
    super(message);
    this.name = 'ClamAvUnavailableError';
  }
}

export async function scanBufferWithClamAv(buffer: Buffer, config: ClamAvConfig): Promise<void> {
  if (!config.enabled) return;

  const tmpPath = join(tmpdir(), `bc-upload-${randomUUID()}`);
  try {
    await writeFile(tmpPath, buffer);
    const { stdout } = await execFileAsync(config.binary, ['--no-summary', tmpPath], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    const out = String(stdout ?? '').trim();
    if (out.endsWith('FOUND')) {
      throw new Error('Malware detected');
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Malware detected') {
      throw err;
    }
    log.error(`Scan antivirus indisponible (${config.binary}) — fichier rejeté.`);
    throw new ClamAvUnavailableError();
  } finally {
    await unlink(tmpPath).catch(() => undefined);
  }
}
