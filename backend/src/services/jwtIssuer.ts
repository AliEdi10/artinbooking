import crypto from 'crypto';

interface IssueJwtParams {
  sub: string;
  email: string;
  role?: string;
  drivingSchoolId?: number | null;
  expiresInSeconds?: number;
}

function normalizePrivateKey(): crypto.KeyObject {
  const rawKey = process.env.AUTH_LOCAL_PRIVATE_KEY || process.env.AUTH_EMULATOR_PRIVATE_KEY;
  if (!rawKey) {
    throw new Error('AUTH_LOCAL_PRIVATE_KEY or AUTH_EMULATOR_PRIVATE_KEY is required to issue tokens');
  }

  const normalized = rawKey.includes('BEGIN') ? rawKey : Buffer.from(rawKey, 'base64').toString('utf8');
  return crypto.createPrivateKey({ key: normalized });
}

export function issueLocalJwt(params: IssueJwtParams): string {
  const key = normalizePrivateKey();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresInSeconds = params.expiresInSeconds ?? 60 * 60; // default 1h

  const issuer = process.env.AUTH_LOCAL_ISSUER || process.env.AUTH_ISSUER || 'local-artinbk-auth';
  const audience = process.env.AUTH_LOCAL_AUDIENCE || process.env.AUTH_AUDIENCE || 'artinbk-local';
  const kid = process.env.AUTH_LOCAL_KEY_ID || 'local-key';

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid,
  };

  const claims: Record<string, unknown> = {
    iss: issuer,
    aud: audience,
    sub: params.sub,
    email: params.email,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
  };

  if (params.role) claims.role = params.role;
  if (params.drivingSchoolId !== undefined) claims.driving_school_id = params.drivingSchoolId;

  const headerSegment = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadSegment = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signingInput = `${headerSegment}.${payloadSegment}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(key, 'base64url');
  return `${signingInput}.${signature}`;
}

export function publicKeyForLocalJwt(): string {
  const key = normalizePrivateKey();
  const publicKey = crypto.createPublicKey(key);
  return publicKey.export({ format: 'pem', type: 'spki' }).toString();
}
