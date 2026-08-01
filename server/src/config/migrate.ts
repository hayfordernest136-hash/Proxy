import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { pool } from './db';

dotenv.config();

const schemaFixes = [
  {
    table: 'users',
    column: 'role',
    ddl: "ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user'",
  },
  {
    table: 'users',
    column: 'referral_code',
    ddl: 'ALTER TABLE users ADD COLUMN referral_code VARCHAR(32) UNIQUE',
  },
  {
    table: 'users',
    column: 'referral_reward_used_at',
    ddl: 'ALTER TABLE users ADD COLUMN referral_reward_used_at TIMESTAMP NULL',
  },
  {
    table: 'orders',
    column: 'referral_discount_applied',
    ddl: 'ALTER TABLE orders ADD COLUMN referral_discount_applied TINYINT(1) NOT NULL DEFAULT 0',
  },
  // Product/card management fields
  {
    table: 'products',
    column: 'number_of_ips',
    ddl: 'ALTER TABLE products ADD COLUMN number_of_ips INT DEFAULT NULL',
  },
  {
    table: 'products',
    column: 'pricing_unit',
    ddl: "ALTER TABLE products ADD COLUMN pricing_unit VARCHAR(16) NOT NULL DEFAULT 'ip'",
  },
  {
    table: 'products',
    column: 'updated_at',
    ddl: "ALTER TABLE products ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  },
  {
    table: 'products',
    column: 'duration_days',
    ddl: 'ALTER TABLE products ADD COLUMN duration_days INT DEFAULT NULL',
  },
  {
    table: 'plans',
    column: 'number_of_ips',
    ddl: 'ALTER TABLE plans ADD COLUMN number_of_ips INT DEFAULT NULL',
  },
  {
    table: 'plans',
    column: 'updated_at',
    ddl: "ALTER TABLE plans ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  },
  {
    table: 'products',
    column: 'discount_price',
    ddl: 'ALTER TABLE products ADD COLUMN discount_price DECIMAL(10,2) DEFAULT NULL',
  },
  {
    table: 'products',
    column: 'availability_status',
    ddl: "ALTER TABLE products ADD COLUMN availability_status VARCHAR(32) DEFAULT 'available'",
  },
  // Orders fields for delivery workflows
  {
    table: 'orders',
    column: 'delivery_method',
    ddl: "ALTER TABLE orders ADD COLUMN delivery_method VARCHAR(32) DEFAULT NULL",
  },
  {
    table: 'orders',
    column: 'cd_key',
    ddl: "ALTER TABLE orders ADD COLUMN cd_key TEXT DEFAULT NULL",
  },
  {
    table: 'orders',
    column: 'refill_proof_url',
    ddl: "ALTER TABLE orders ADD COLUMN refill_proof_url VARCHAR(512) DEFAULT NULL",
  },
  {
    table: 'orders',
    column: 'delivery_status',
    ddl: "ALTER TABLE orders ADD COLUMN delivery_status VARCHAR(32) DEFAULT 'pending'",
  },
  {
    table: 'orders',
    column: 'payment_fee',
    ddl: 'ALTER TABLE orders ADD COLUMN payment_fee DECIMAL(10,2) NOT NULL DEFAULT 0',
  },
  {
    table: 'orders',
    column: 'payment_total_amount',
    ddl: 'ALTER TABLE orders ADD COLUMN payment_total_amount DECIMAL(10,2) NOT NULL DEFAULT 0',
  },
  {
    table: 'orders',
    column: 'support_message_unread',
    ddl: 'ALTER TABLE orders ADD COLUMN support_message_unread TINYINT(1) NOT NULL DEFAULT 0',
  },
  {
    table: 'orders',
    column: 'admin_notes',
    ddl: "ALTER TABLE orders ADD COLUMN admin_notes TEXT DEFAULT NULL",
  },
];

async function ensureSchemaColumnExists(table: string, column: string, ddl: string) {
  const dbName = process.env.DB_NAME;
  if (!dbName) return;

  const [rows] = await pool.query(
    'SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [dbName, table, column],
  );
  const exists = Number((rows as any[])[0]?.count ?? 0) > 0;
  if (!exists) {
    try {
      await pool.query(ddl);
      console.log(`Added missing column ${table}.${column}`);
    } catch (error: any) {
      console.warn(`Unable to add missing column ${table}.${column}:`, error.message || error);
    }
  }
}

export async function runMigrations() {
  const file = path.resolve(__dirname, '..', '..', 'sql', 'schema.sql');
  if (!fs.existsSync(file)) {
    console.log('No migration file found:', file);
    return;
  }
  const sql = fs.readFileSync(file, 'utf8');
  // Naive split on semicolons to execute statements sequentially
  const parts = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of parts) {
    try {
      await pool.query(stmt);
    } catch (e: any) {
      // Log and continue: statements may already exist
      console.warn('Migration statement failed (continuing):', e.message || e);
    }
  }

  for (const fix of schemaFixes) {
    await ensureSchemaColumnExists(fix.table, fix.column, fix.ddl);
  }

  // Ensure order_events table exists for timeline/history
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_events (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        order_id BIGINT NOT NULL,
        status VARCHAR(64) NOT NULL,
        message TEXT,
        meta JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Ensured order_events table exists.');
  } catch (e: any) {
    console.warn('Unable to ensure order_events table:', e.message || e);
  }

  console.log('Migrations applied (or already present).');
}

export async function seedSampleProducts() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  try {
    const [rows] = await pool.query('SELECT slug FROM products');
    const existingSlugs = new Set((rows as any[]).map((row) => row.slug));

    const seedProducts = [
      {
        slug: 'rotating-residential',
        name: 'Rotating Residential Proxy',
        description:
          'High-availability residential IPs with automatic rotation for web scraping, social media, and ad verification.',
        proxy_type: 'Residential',
        location: 'Global',
        image_url: null,
        features: ['Unlimited bandwidth', 'Auto IP rotation', 'High success rate'],
        supports_cd_key: true,
        supports_account_refill: false,
        sort_order: 100,
        plans: [
          { name: 'Starter', price: 14.99, currency: 'GHS', sort_order: 0 },
          { name: 'Business', price: 29.99, currency: 'GHS', sort_order: 1 },
        ],
      },
      {
        slug: 'static-isp',
        name: 'Static ISP Proxy',
        description:
          'Stable static IP addresses for banking, streaming, and online services requiring consistent identity.',
        proxy_type: 'Static ISP',
        location: 'Ghana',
        image_url: null,
        features: ['Static IPs', 'Low latency', 'Reliable access'],
        supports_cd_key: true,
        supports_account_refill: true,
        sort_order: 200,
        plans: [
          { name: 'Standard', price: 24.99, currency: 'GHS', sort_order: 0 },
          { name: 'Premium', price: 44.99, currency: 'GHS', sort_order: 1 },
        ],
      },
      {
        slug: 'mobile-4g-proxy',
        name: 'Mobile 4G/5G Proxy',
        description:
          'Mobile IPs with 4G/5G connectivity, ideal for verification, ad testing, and location-specific browsing.',
        proxy_type: 'Mobile',
        location: 'Africa',
        image_url: null,
        features: ['4G/5G connections', 'Mobile carrier IPs', 'Quick setup'],
        supports_cd_key: false,
        supports_account_refill: true,
        sort_order: 300,
        plans: [
          { name: 'Mobile Basic', price: 19.99, currency: 'GHS', sort_order: 0 },
          { name: 'Mobile Pro', price: 39.99, currency: 'GHS', sort_order: 1 },
        ],
      },
      {
        slug: 'dedicated-ipv4',
        name: 'Dedicated IPv4 Proxy',
        description:
          'Dedicated IPv4 addresses for secure access, low-risk logins, and high-stability applications.',
        proxy_type: 'Dedicated',
        location: 'Global',
        image_url: null,
        features: ['Dedicated IP', 'High uptime', 'Low fraud risk'],
        supports_cd_key: true,
        supports_account_refill: true,
        sort_order: 400,
        plans: [
          { name: 'Basic', price: 29.99, currency: 'GHS', sort_order: 0 },
          { name: 'Pro', price: 54.99, currency: 'GHS', sort_order: 1 },
        ],
      },
      {
        slug: 'bandwidth-plan',
        name: 'Bandwidth Proxy Plan',
        description:
          'Flexible bandwidth-based proxy access for large volumes, traffic bursts, and cost-efficient usage.',
        proxy_type: 'Bandwidth',
        location: 'Global',
        image_url: null,
        features: ['Flexible data', 'Burst capacity', 'Pay-as-you-go'],
        supports_cd_key: false,
        supports_account_refill: true,
        sort_order: 500,
        plans: [
          { name: '100GB', price: 19.99, currency: 'GHS', sort_order: 0 },
          { name: '250GB', price: 39.99, currency: 'GHS', sort_order: 1 },
        ],
      },
    ];

    let seededCount = 0;
    for (const product of seedProducts) {
      if (existingSlugs.has(product.slug)) {
        continue;
      }

      const [result] = await pool.query(
        'INSERT INTO products (slug, name, description, proxy_type, location, image_url, features, supports_cd_key, supports_account_refill, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          product.slug,
          product.name,
          product.description,
          product.proxy_type,
          product.location,
          product.image_url,
          JSON.stringify(product.features),
          product.supports_cd_key ? 1 : 0,
          product.supports_account_refill ? 1 : 0,
          1,
          product.sort_order,
        ],
      );

      const productId = (result as any).insertId;
      for (const plan of product.plans) {
        await pool.query(
          'INSERT INTO plans (product_id, name, price, currency, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
          [productId, plan.name, plan.price, plan.currency, 1, plan.sort_order],
        );
      }
      seededCount += 1;
    }

    if (seededCount > 0) {
      console.log(`Seeded ${seededCount} sample product${seededCount === 1 ? '' : 's'}.`);
    }
  } catch (error: any) {
    console.warn('Unable to seed sample products:', error.message || error);
  }
}

export async function ensureAdminUser() {
  const configuredAdminEmails = [process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
    .filter((value): value is string => Boolean(value))
    .join(',')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const adminEmail = configuredAdminEmails[0];
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminName = process.env.ADMIN_NAME?.trim() || 'Administrator';

  if (!adminEmail || !adminPassword) {
    return;
  }

  const [rows] = await pool.query('SELECT id, role FROM users WHERE email = ? LIMIT 1', [adminEmail]);
  const existing = (rows as any[])[0];
  if (existing) {
    if (existing.role !== 'admin') {
      await pool.query('UPDATE users SET role = ? WHERE id = ?', ['admin', existing.id]);
      console.log(`Promoted existing user ${adminEmail} to admin.`);
    }
    return;
  }

  const { createUser } = await import('../services/user.service');
  const user = await createUser({
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
  });
  console.log(`Admin user seeded: ${user.email}`);
}

export default runMigrations;
