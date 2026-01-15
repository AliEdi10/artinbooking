const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function createSuperadmin() {
    const password = 'G13791465rr';
    const email = 'info@artindriving.com';

    const hash = await bcrypt.hash(password, 10);
    console.log('Hash generated:', hash);

    const client = new Client({
        connectionString: 'postgresql://postgres:ZNjLdwpHQppFaxVTsjayqNLhOkKaweOA@crossover.proxy.rlwy.net:10833/railway',
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    const result = await client.query(
        `INSERT INTO users (email, identity_provider, identity_subject, role, password_hash, driving_school_id, created_at, status)
     VALUES ($1, 'local', 'superadmin-local', 'SUPERADMIN', $2, NULL, NOW(), 'active')
     RETURNING id, email, role`,
        [email, hash]
    );

    console.log('User created:', result.rows[0]);
    await client.end();
}

createSuperadmin().catch(console.error);
