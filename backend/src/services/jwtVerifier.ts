import crypto from 'crypto';
import https from 'https';
import express from 'express';
import { UserRole } from '../models';

interface JwtHeader {
  kid?: string;
  alg?: string;
  typ?: string;
}

interface JwtClaims {
  aud?: string | string[];
  exp?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
  email?: string;
  [key: string]: unknown;
}

interface VerificationResult {
  sub?: string;
  email?: string;
  provider: string;
  claims: JwtClaims;
  emulatedRole?: UserRole;
  emulatedDrivingSchoolId?: number | null;
}

type RemoteJwk = crypto.JsonWebKey & { kid?: string };

interface JwksResponse {
  keys: RemoteJwk[];
}

const JWKS_CACHE_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const DEFAULT_ISSUER = 'https://accounts.google.com';
const DEFAULT_LOCAL_ISSUER = 'local-artinbk-auth';

const jwksCache: Record<string, { keys: RemoteJwk[]; fetchedAt: number }> = {};

function decodeSegment(segment: string): Record<string, unknown> {
  const json = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

function readPrivateKeyFromEnv(value?: string): crypto.KeyObject | null {
  if (!value) return null;

  const normalized = value.includes('BEGIN') ? value : Buffer.from(value, 'base64').toString('utf8');
  try {
    return crypto.createPrivateKey({ key: normalized });
  } catch (error) {
    throw new Error('Invalid local private key provided');
  }
}

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Failed to fetch JWKS (${res.statusCode})`));
            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

async function loadJwks(jwksUri: string): Promise<RemoteJwk[]> {
  const cached = jwksCache[jwksUri];
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_MS) {
    return cached.keys;
  }

  const response = (await fetchJson(jwksUri)) as JwksResponse;
  if (!response.keys) {
    throw new Error('JWKS response missing keys');
  }

  jwksCache[jwksUri] = { keys: response.keys, fetchedAt: Date.now() };
  return response.keys;
}

function getKeyForKid(jwks: RemoteJwk[], kid?: string): RemoteJwk {
  if (kid) {
    const match = jwks.find((key) => key.kid === kid);
    if (match) return match;
  }

  if (jwks.length === 1) {
    return jwks[0];
  }

  throw new Error('Unable to locate matching JWK');
}

function verifySignature(token: string, jwk: RemoteJwk) {
  const [header, payload, signature] = token.split('.');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${header}.${payload}`);
  verifier.end();

  const publicKey = crypto.createPublicKey({ format: 'jwk', key: jwk });
  const signatureBuffer = Buffer.from(signature, 'base64url');

  if (!verifier.verify(publicKey, signatureBuffer)) {
    throw new Error('JWT signature invalid');
  }
}

function verifySignatureWithKey(token: string, key: crypto.KeyObject) {
  const [header, payload, signature] = token.split('.');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${header}.${payload}`);
  verifier.end();

  const publicKey = crypto.createPublicKey(key);
  const signatureBuffer = Buffer.from(signature, 'base64url');

  if (!verifier.verify(publicKey, signatureBuffer)) {
    throw new Error('JWT signature invalid');
  }
}

function assertClaimsValid(claims: JwtClaims, issuer: string, audience?: string) {
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (claims.exp && nowSeconds >= claims.exp) {
    throw new Error('JWT expired');
  }

  if (claims.nbf && nowSeconds < claims.nbf) {
    throw new Error('JWT not yet valid');
  }

  if (!claims.iss) {
    throw new Error('Missing issuer');
  }

  if (claims.iss !== issuer) {
    throw new Error('Unexpected issuer');
  }

  if (audience) {
    if (Array.isArray(claims.aud)) {
      if (!claims.aud.includes(audience)) {
        throw new Error('Audience mismatch');
      }
    } else if (claims.aud !== audience) {
      throw new Error('Audience mismatch');
    }
  }
}

function readEmulatedUser(req: express.Request) {
  const roleHeader = req.get('x-test-user-role');
  const drivingSchoolHeader = req.get('x-test-driving-school-id');

  return {
    sub: req.get('x-test-user-sub'),
    email: req.get('x-test-user-email') ?? process.env.AUTH_EMULATOR_EMAIL,
    role: (roleHeader as UserRole | undefined) ?? (process.env.AUTH_EMULATOR_ROLE as UserRole | undefined),
    drivingSchoolId: drivingSchoolHeader
      ? Number(drivingSchoolHeader)
      : process.env.AUTH_EMULATOR_DRIVING_SCHOOL_ID
        ? Number(process.env.AUTH_EMULATOR_DRIVING_SCHOOL_ID)
        : undefined,
  };
}

export async function verifyJwtFromRequest(
  req: express.Request,
  token: string,
): Promise<VerificationResult> {
  const emulatorEnabled = process.env.AUTH_EMULATOR === 'true';
  const localJwtEnabled = process.env.AUTH_LOCAL_JWT === 'true';

  if (emulatorEnabled) {
    const emulated = readEmulatedUser(req);
    return {
      sub: emulated.sub ?? emulated.email,
      email: emulated.email,
      provider: 'emulated',
      claims: { iss: 'emulated', aud: 'emulated' },
      emulatedRole: emulated.role,
      emulatedDrivingSchoolId: emulated.drivingSchoolId ?? null,
    };
  }

  const [headerSegment, payloadSegment] = token.split('.');
  const header = decodeSegment(headerSegment) as JwtHeader;
  const claims = decodeSegment(payloadSegment) as JwtClaims;

  if (header.alg !== 'RS256') {
    throw new Error('Unsupported JWT algorithm');
  }

  const issuer = process.env.AUTH_ISSUER || DEFAULT_ISSUER;
  const audience = process.env.AUTH_AUDIENCE;
  const provider = process.env.AUTH_PROVIDER || 'google';

  const localPrivateKey = readPrivateKeyFromEnv(process.env.AUTH_LOCAL_PRIVATE_KEY);
  const localIssuer = process.env.AUTH_LOCAL_ISSUER || DEFAULT_LOCAL_ISSUER;
  const localAudience = process.env.AUTH_LOCAL_AUDIENCE || audience;
  const localProvider = process.env.AUTH_LOCAL_PROVIDER || provider;

  if (!claims.sub && !claims.email) {
    throw new Error('Token missing subject or email');
  }

  if (localJwtEnabled && localPrivateKey) {
    if (process.env.AUTH_LOCAL_KEY_ID && header.kid !== process.env.AUTH_LOCAL_KEY_ID) {
      throw new Error('Unexpected key id');
    }

    assertClaimsValid(claims, localIssuer, localAudience);
    verifySignatureWithKey(token, localPrivateKey);

    return {
      sub: claims.sub,
      email: claims.email,
      provider: localProvider,
      claims,
    };
  }

  assertClaimsValid(claims, issuer, audience);

  const jwksUri = process.env.AUTH_JWKS_URI || DEFAULT_JWKS_URI;
  const jwks = await loadJwks(jwksUri);
  const jwk = getKeyForKid(jwks, header.kid);
  verifySignature(token, jwk);

  return {
    sub: claims.sub,
    email: claims.email,
    provider,
    claims,
  };
}
