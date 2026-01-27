import { randomBytes } from 'crypto';
import { getPool } from '../db';

interface PasswordResetToken {
    id: number;
    userId: number;
    token: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
}

interface PasswordResetTokenRow {
    id: number;
    user_id: number;
    token: string;
    expires_at: Date;
    used_at: Date | null;
    created_at: Date;
}

function mapToken(row: PasswordResetTokenRow): PasswordResetToken {
    return {
        id: row.id,
        userId: row.user_id,
        token: row.token,
        expiresAt: row.expires_at,
        usedAt: row.used_at,
        createdAt: row.created_at,
    };
}

/**
 * Generate a secure random token for password reset
 */
function generateToken(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Create a new password reset token for a user
 * Token expires after 1 hour
 * Invalidates any existing tokens for this user
 */
export async function createPasswordResetToken(userId: number): Promise<string> {
    const pool = getPool();

    // Invalidate any existing unused tokens for this user
    await pool.query(
        `UPDATE password_reset_tokens 
     SET used_at = NOW() 
     WHERE user_id = $1 AND used_at IS NULL`,
        [userId]
    );

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
        [userId, token, expiresAt]
    );

    return token;
}

/**
 * Find a valid (not expired, not used) password reset token
 */
export async function findValidPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const result = await getPool().query<PasswordResetTokenRow>(
        `SELECT * FROM password_reset_tokens 
     WHERE token = $1 
       AND used_at IS NULL 
       AND expires_at > NOW()
     LIMIT 1`,
        [token]
    );

    if (result.rowCount === 0) return null;
    return mapToken(result.rows[0]);
}

/**
 * Mark a token as used
 */
export async function markTokenUsed(tokenId: number): Promise<void> {
    await getPool().query(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
        [tokenId]
    );
}

/**
 * Update a user's password hash
 */
export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
    await getPool().query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, userId]
    );
}

/**
 * Cleanup expired tokens (can be called periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
    const result = await getPool().query(
        `DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`
    );
    return result.rowCount ?? 0;
}
