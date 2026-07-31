import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes/index';
import { runMigrations, seedSampleProducts, ensureAdminUser } from './config/migrate';
import { connectWithRetry } from './config/db';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { sanitizeInput } from './middleware/validate.middleware';

// Load environment variables
const rootEnvPath = path.resolve(process.cwd(), '.env');
const serverEnvPath = path.resolve(process.cwd(), 'server/.env');

dotenv.config({ path: serverEnvPath });
dotenv.config({ path: rootEnvPath });

// ---- Validate required environment variables ----
const REQUIRED_ENV_VARS = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME', 'JWT_SECRET', 'FRONTEND_URL'] as const;

const missing: string[] = [];
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  console.error(
    `[FATAL] Missing required environment variables:\n  ${missing.join('\n  ')}\n` +
    'Please set them before starting the server.',
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';

// Trust Render proxy
app.set('trust proxy', 1);

// ---- Security Headers ----
app.use(
  helmet({
    contentSecurityPolicy: isProd ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ---- Compression ----
app.use(compression());

// ---- Request Logging ----
if (isProd) {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// ---- Body Parsing ----
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ---- Input Sanitization ----
app.use(sanitizeInput);

// ---- Rate Limiting ----
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use('/api', globalLimiter);

// ---- CORS ----
const frontendUrl = process.env.FRONTEND_URL?.replace(/\/+$/, '') || '';
const corsOrigins = [frontendUrl].filter(Boolean);

if (!isProd) {
  corsOrigins.push(
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin) || corsOrigins.length === 0) {
        return callback(null, true);
      }
      callback(new Error(`CORS origin denied: ${origin}`));
    },
    credentials: true,
  }),
);

// ---- API Routes ----
app.use('/api', apiRoutes);

// ---- Static Files ----
app.use('/uploads', express.static(path.resolve(process.cwd(), 'server', 'uploads')));

// ---- Health Check ----
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---- 404 Handler ----
app.use(notFoundHandler);

// ---- Global Error Handler ----
app.use(errorHandler);

// ---- Start Server ----
async function start() {
  // Connect to database with retry logic
  await connectWithRetry();

  try {
    await runMigrations();
  } catch (e) {
    console.warn('Migration step failed:', e);
  }

  try {
    await ensureAdminUser();
  } catch (e) {
    console.warn('Admin user seeding failed:', e);
  }

  // Only seed sample data in non-production environments
  if (!isProd) {
    try {
      await seedSampleProducts();
    } catch (e) {
      console.warn('Sample product seeding failed:', e);
    }
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${isProd ? 'production' : 'development'}]`);
  });
}

start();

