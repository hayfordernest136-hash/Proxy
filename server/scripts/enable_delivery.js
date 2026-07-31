const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const path = require('path');

// Load server and root env like server startup
const rootEnvPath = path.resolve(process.cwd(), '.env');
const serverEnvPath = path.resolve(process.cwd(), 'server/.env');
dotenv.config({ path: serverEnvPath });
dotenv.config({ path: rootEnvPath });

async function run() {
  const { DB_HOST='127.0.0.1', DB_PORT='3306', DB_USER='root', DB_PASSWORD='', DB_NAME='proxyzone' } = process.env;
  const pool = mysql.createPool({ host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
  try {
    const [result] = await pool.query('UPDATE products SET supports_cd_key = 1, supports_account_refill = 1');
    console.log('OK', result.affectedRows, 'rows updated');
  } catch (err) {
    console.error('Failed:', err.message || err);
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

run();
