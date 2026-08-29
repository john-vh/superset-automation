import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignature } from './signature.js';

const secret = 'shhh';
const body = Buffer.from(JSON.stringify({ action: 'opened' }));
const valid = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifySignature', () => {
  it('accepts a signature produced with the shared secret', () => {
    expect(verifySignature(secret, body, valid)).toBe(true);
  });

  it('rejects a wrong secret, a tampered body and a malformed header', () => {
    expect(verifySignature('other', body, valid)).toBe(false);
    expect(verifySignature(secret, Buffer.from('{}'), valid)).toBe(false);
    expect(verifySignature(secret, body, valid.replace('sha256=', ''))).toBe(false);
    expect(verifySignature(secret, body, undefined)).toBe(false);
  });
});
