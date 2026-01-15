const https = require('https');

// You'd need to replace this with an actual valid JWT token
const TOKEN = 'YOUR_JWT_TOKEN_HERE';

const options = {
    hostname: 'artinbooking-production.up.railway.app',
    port: 443,
    path: '/schools/1/bookings',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => console.log('Response:', body));
});

req.on('error', (e) => console.error('Error:', e.message));
req.end();
