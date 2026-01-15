const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const fs = require('fs');

// Save as base64 for environment variable
const privateKeyBase64 = Buffer.from(privateKey).toString('base64');

fs.writeFileSync('private_key_base64.txt', privateKeyBase64);
fs.writeFileSync('public_key.pem', publicKey);

console.log('Keys generated!');
console.log('Private key (base64) saved to: private_key_base64.txt');
console.log('Public key saved to: public_key.pem');
console.log('');
console.log('Add this to Railway as AUTH_LOCAL_PRIVATE_KEY:');
console.log('');
console.log(privateKeyBase64);
