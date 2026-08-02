import mysql from 'mysql2/promise';

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'brokeflex_data',
} = process.env;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});


(pool as any).on('error', (err: any) => {
  console.error('[DB Pool Error]', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
    console.warn('[DB] Connection lost. Pool will attempt to reconnect automatically.');
  }
});

// Handle connection errors
(pool as any).on('connection', (connection: any) => {
  console.log('[DB] New connection established');
  connection.on('error', (err: any) => {
    console.error('[DB Connection Error]', err.message);
  });
});

/**
 * Test database connectivity with retries.
 * Exits the process if the database is unreachable after MAX_RETRIES attempts.
 */
export async function connectWithRetry(): Promise<void> {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      console.log('[DB] Database connection established successfully');
      return;
    } catch (error: any) {
      attempt++;
      console.error(
        `[DB] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message || error}`,
      );
      if (attempt < MAX_RETRIES) {
        console.log(`[DB] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  console.error(`[DB] Failed to connect after ${MAX_RETRIES} attempts. Exiting.`);
  process.exit(1);
}

export default pool;
