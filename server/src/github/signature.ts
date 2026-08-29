import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Validates GitHub's `X-Hub-Signature-256` header against the raw request body.
 * Returns false for a malformed header rather than throwing.
 */
export function verifySignature(secret: string, body: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  const provided = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return false;

  return timingSafeEqual(provided, expectedBuffer);
}
