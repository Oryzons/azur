import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

export function hashSignedContractHtml(html: string): string {
  return createHash('sha256').update(html, 'utf8').digest('hex');
}

export function assertSignedHtmlIntegrity(html: string, expectedSha256: string | null | undefined): void {
  if (!expectedSha256?.trim()) return;
  const actual = hashSignedContractHtml(html);
  if (actual !== expectedSha256) {
    throw new BadRequestException(
      'Intégrité du contrat archivé compromise — contactez le support avant toute utilisation du document.',
    );
  }
}
