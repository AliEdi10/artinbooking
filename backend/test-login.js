const https = require('https');

const data = JSON.stringify({
    email: 'info@artindriving.com',
    password: 'G13791465rr'
});

const options = {
    hostname: 'artinbooking-production.up.railway.app',
    port: 443,
    path: '/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => console.log('Response:', body));
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
