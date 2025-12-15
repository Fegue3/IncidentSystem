import { stableStringify, computeHmacSha256Hex } from '../../src/audit/incident-audit';

describe('incident-audit utils', () => {
  it('stableStringify é determinístico (ordem de keys não muda output)', () => {
    const a = { b: 1, a: 2, c: { z: 9, y: 8 } };
    const b = { c: { y: 8, z: 9 }, a: 2, b: 1 };

    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('HMAC muda se payload mudar', () => {
    const secret = 's';
    const h1 = computeHmacSha256Hex(secret, 'payload-1');
    const h2 = computeHmacSha256Hex(secret, 'payload-2');
    expect(h1).not.toBe(h2);
  });
});