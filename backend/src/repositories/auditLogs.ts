import { query } from '../db';

export interface AuditLog {
    id: number;
    drivingSchoolId: number | null;
    actorUserId: number | null;
    action: string;
    entityType: string | null;
    entityId: number | null;
    details: Record<string, unknown> | null;
    createdAt: Date;
}

export interface CreateAuditLogParams {
    drivingSchoolId?: number | null;
    actorUserId?: number | null;
    action: string;
    entityType?: string | null;
    entityId?: number | null;
    details?: Record<string, unknown> | null;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<AuditLog> {
    const result = await query<{
        id: number;
        driving_school_id: number | null;
        actor_user_id: number | null;
        action: string;
        entity_type: string | null;
        entity_id: number | null;
        details: Record<string, unknown> | null;
        created_at: Date;
    }>(
        `INSERT INTO audit_logs (driving_school_id, actor_user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
        [
            params.drivingSchoolId ?? null,
            params.actorUserId ?? null,
            params.action,
            params.entityType ?? null,
            params.entityId ?? null,
            params.details ? JSON.stringify(params.details) : null,
        ]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        drivingSchoolId: row.driving_school_id,
        actorUserId: row.actor_user_id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        details: row.details,
        createdAt: row.created_at,
    };
}

/**
 * List audit logs for a school with pagination
 */
export async function listAuditLogs(
    schoolId: number,
    options: { limit?: number; offset?: number; entityType?: string } = {}
): Promise<{ logs: AuditLog[]; total: number }> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    let whereClause = 'WHERE driving_school_id = $1';
    const params: (number | string)[] = [schoolId];

    if (options.entityType) {
        whereClause += ' AND entity_type = $2';
        params.push(options.entityType);
    }

    const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
        params
    );

    const logsResult = await query<{
        id: number;
        driving_school_id: number | null;
        actor_user_id: number | null;
        action: string;
        entity_type: string | null;
        entity_id: number | null;
        details: Record<string, unknown> | null;
        created_at: Date;
    }>(
        `SELECT * FROM audit_logs ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );

    return {
        logs: logsResult.rows.map((row) => ({
            id: row.id,
            drivingSchoolId: row.driving_school_id,
            actorUserId: row.actor_user_id,
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id,
            details: row.details,
            createdAt: row.created_at,
        })),
        total: parseInt(countResult.rows[0].count, 10),
    };
}
