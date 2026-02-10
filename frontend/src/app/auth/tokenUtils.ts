import type { AuthUser } from './AuthProvider';

export function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  if (typeof atob === 'function') {
    return decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
  }
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function parseToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    // JWT must have exactly 3 parts: header.payload.signature
    if (parts.length !== 3 || !parts[1]) {
      console.warn('Invalid token format: expected JWT with 3 parts');
      return null;
    }
    const payload = parts[1];
    const json = JSON.parse(decodeBase64Url(payload));
    const role = (json.role as string | undefined) ?? (json['https://artinbk.app/role'] as string | undefined);
    const schoolIdValue =
      (json.driving_school_id as number | undefined) ??
      (json.drivingSchoolId as number | undefined) ??
      (json['https://artinbk.app/driving_school_id'] as number | undefined);

    const normalizedRole = typeof role === 'string' ? role.toLowerCase() : undefined;

    return {
      email: json.email as string | undefined,
      role: normalizedRole,
      schoolId: typeof schoolIdValue === 'number' ? schoolIdValue : undefined,
      name: typeof json.name === 'string' ? json.name : undefined,
    };
  } catch (error) {
    console.warn('Failed to parse token payload', error);
    return null;
  }
}

