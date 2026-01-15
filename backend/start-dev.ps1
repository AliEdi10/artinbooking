$env:PGHOST='localhost'
$env:PGPORT='5434'
$env:PGUSER='postgres'
$env:PGPASSWORD='postgres'
$env:PGDATABASE='artinbk'
$env:AUTH_EMULATOR='true'
$env:AUTH_EMULATOR_EMAIL='superadmin@example.com'
$env:AUTH_EMULATOR_ROLE='SUPERADMIN'
$env:AUTH_LOCAL_JWT='true'

# Generate a private key for JWT signing
$keyPair = node -e "const crypto = require('crypto'); const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } }); console.log(Buffer.from(privateKey).toString('base64'));"
$env:AUTH_LOCAL_PRIVATE_KEY = $keyPair

npm run dev
