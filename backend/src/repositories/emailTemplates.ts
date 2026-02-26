import { getPool } from '../db';

export type EmailTemplateKey = 'booking_confirmation' | 'booking_cancelled' | 'lesson_reminder' | 'invitation';

export interface EmailTemplate {
  templateKey: EmailTemplateKey;
  subject: string | null;
  customNote: string | null;
  updatedAt: Date;
}

interface EmailTemplateRow {
  template_key: string;
  subject: string | null;
  custom_note: string | null;
  updated_at: Date;
}

function mapEmailTemplate(row: EmailTemplateRow): EmailTemplate {
  return {
    templateKey: row.template_key as EmailTemplateKey,
    subject: row.subject,
    customNote: row.custom_note,
    updatedAt: row.updated_at,
  };
}

export async function getEmailTemplate(
  schoolId: number,
  key: EmailTemplateKey,
): Promise<EmailTemplate | null> {
  const result = await getPool().query<EmailTemplateRow>(
    `SELECT template_key, subject, custom_note, updated_at
     FROM school_email_templates
     WHERE driving_school_id = $1 AND template_key = $2`,
    [schoolId, key],
  );
  if (result.rowCount === 0) return null;
  return mapEmailTemplate(result.rows[0]);
}

export async function getAllEmailTemplates(schoolId: number): Promise<EmailTemplate[]> {
  const result = await getPool().query<EmailTemplateRow>(
    `SELECT template_key, subject, custom_note, updated_at
     FROM school_email_templates
     WHERE driving_school_id = $1
     ORDER BY template_key`,
    [schoolId],
  );
  return result.rows.map(mapEmailTemplate);
}

export async function upsertEmailTemplate(
  schoolId: number,
  key: EmailTemplateKey,
  subject: string | null,
  customNote: string | null,
): Promise<EmailTemplate> {
  const result = await getPool().query<EmailTemplateRow>(
    `INSERT INTO school_email_templates (driving_school_id, template_key, subject, custom_note, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (driving_school_id, template_key) DO UPDATE SET
       subject = EXCLUDED.subject,
       custom_note = EXCLUDED.custom_note,
       updated_at = NOW()
     RETURNING template_key, subject, custom_note, updated_at`,
    [schoolId, key, subject || null, customNote || null],
  );
  return mapEmailTemplate(result.rows[0]);
}
