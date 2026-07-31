const mysql = require('mysql2/promise');
const fetch = require('node-fetch');

(async () => {
  const base = 'http://localhost:4000';
  const email = `testuser_${Date.now()}@example.com`;
  const password = 'SecurePass123!';
  const name = 'Test User';

  try {
    console.log('REGISTERING', email);
    const regRes = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, email, password }),
    });
    const regBody = await regRes.text();
    console.log('REGISTER status', regRes.status);
    console.log('REGISTER body', regBody);
    console.log('REGISTER cookie', regRes.headers.get('set-cookie'));

    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'proxyzone',
    });

    const [users] = await conn.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    console.log('DB users count', users.length);
    if (users.length) {
      console.log('DB user', { id: users[0].id, email: users[0].email, name: users[0].name });
    }

    const [profiles] = await conn.query('SELECT * FROM profiles WHERE user_id = ?', [users.length ? users[0].id : null]);
    console.log('DB profiles count', profiles.length);
    if (profiles.length) {
      console.log('DB profile', { id: profiles[0].id, user_id: profiles[0].user_id, name: profiles[0].name });
    }

    await conn.end();

    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await loginRes.text();
    console.log('LOGIN status', loginRes.status);
    console.log('LOGIN body', loginBody);
    console.log('LOGIN cookie', loginRes.headers.get('set-cookie'));

    const logoutRes = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: regRes.headers.get('set-cookie') || '' },
    });
    console.log('LOGOUT status', logoutRes.status);
    console.log('LOGOUT body', await logoutRes.text());

    const login2Res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    console.log('LOGIN2 status', login2Res.status);
    console.log('LOGIN2 body', await login2Res.text());
    console.log('LOGIN2 cookie', login2Res.headers.get('set-cookie'));
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
