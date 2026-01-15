-- Seed a platform-level superadmin
-- Identity subject should match the configured IdP (e.g., Google sub claim).
INSERT INTO users (id, email, identity_provider, identity_subject, role, status, created_at, updated_at)
VALUES (
    1,
    'superadmin@example.com',
    'google',
    'superadmin-google-sub',
    'SUPERADMIN',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;
