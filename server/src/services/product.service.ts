import { pool } from '../config/db';

type ProductRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  proxy_type: string;
  location: string;
  image_url: string | null;
  features: any;
  pricing_unit?: string | null;
  supports_cd_key: number;
  supports_account_refill: number;
  is_active: number;
  sort_order: number;
  created_at: string;
};

type PlanRow = {
  id: number;
  product_id: number;
  name: string;
  price: string;
  currency: string;
  is_active: number;
  number_of_ips?: number | null;
  sort_order: number;
  created_at: string;
};

type PriceRow = {
  id: number;
  product_id: number;
  number_of_ips: number;
  price: string;
  currency: string;
  sort_order: number;
  created_at: string;
};

export type ProductPrice = {
  id: number;
  product_id: number;
  number_of_ips: number;
  price: number;
  currency: string;
  sort_order: number;
  created_at: string;
};

function parseFeatures(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as string[];
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function normalizeProduct(product: ProductRow) {
  return {
    ...product,
    image_url: product.image_url ?? null,
    features: parseFeatures(product.features),
    pricing_unit: (product.pricing_unit ?? 'ip').toLowerCase() === 'gb' ? 'gb' : 'ip',
    supports_cd_key: Boolean(product.supports_cd_key),
    supports_account_refill: Boolean(product.supports_account_refill),
    is_active: Boolean(product.is_active),
  };
}

export type ProductPlan = {
  id: number;
  product_id: number;
  name: string;
  price: number;
  currency: string;
  is_active: boolean;
  number_of_ips?: number | null;
  sort_order: number;
  created_at: string;
};

function normalizePlan(plan: PlanRow): ProductPlan {
  return {
    ...plan,
    price: Number(plan.price),
    is_active: Boolean(plan.is_active),
    number_of_ips: (plan as any).number_of_ips ?? null,
    sort_order: plan.sort_order,
  };
}

export async function getActiveProducts(limit?: number) {
  let sql = 'SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order';
  const params: (string | number)[] = [];
  if (typeof limit === 'number') {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const [rows] = await pool.query(sql, params);
  return (rows as ProductRow[]).map(normalizeProduct);
}

export async function getProductBySlug(slug: string) {
  const [rows] = await pool.query('SELECT * FROM products WHERE slug = ? AND is_active = 1 LIMIT 1', [slug]);
  const product = (rows as ProductRow[])[0];
  if (!product) return null;
  return normalizeProduct(product);
}

export async function getProductById(id: number) {
  if (!Number.isFinite(id)) return null;
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
  const product = (rows as ProductRow[])[0];
  if (!product) return null;
  return normalizeProduct(product);
}

export async function getPlansByProductIds(productIds: number[]) {
  if (productIds.length === 0) return [];
  const [rows] = await pool.query(
    'SELECT * FROM plans WHERE product_id IN (?) AND is_active = 1 ORDER BY sort_order',
    [productIds],
  );
  return (rows as PlanRow[]).map(normalizePlan);
}

export async function getPricesByProductIds(productIds: number[]) {
  if (productIds.length === 0) return [];
  const [rows] = await pool.query(
    'SELECT * FROM product_prices WHERE product_id IN (?) ORDER BY sort_order',
    [productIds],
  );
  return (rows as PriceRow[]).map((r) => ({
    ...r,
    price: Number(r.price),
  }));
}

export async function getPlansByProductId(productId: number) {
  const [rows] = await pool.query(
    'SELECT * FROM plans WHERE product_id = ? AND is_active = 1 ORDER BY sort_order',
    [productId],
  );
  return (rows as PlanRow[]).map(normalizePlan);
}

export async function createProduct(product: {
  slug?: string;
  name: string;
  description: string;
  proxy_type: string;
  location: string;
  image_url?: string | null;
  features?: string[];
  pricing_unit?: 'ip' | 'gb';
  supports_cd_key?: boolean;
  supports_account_refill?: boolean;
  is_active?: boolean;
  sort_order?: number;
  number_of_ips?: number | null;
  duration_days?: number | null;
  discount_price?: number | null;
  availability_status?: string | null;
}) {
  // generate slug from name if not provided
  const makeSlug = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .slice(0, 150);

  let slug = product.slug ? String(product.slug).trim() : '';
  if (!slug) slug = makeSlug(product.name || 'product');
  // ensure uniqueness
  const [existsRows] = await pool.query('SELECT COUNT(*) as count FROM products WHERE slug = ?', [slug]);
  if (Number((existsRows as any[])[0]?.count ?? 0) > 0) {
    slug = `${slug}-${Date.now()}`;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO products (slug, name, description, proxy_type, location, image_url, features, pricing_unit, supports_cd_key, supports_account_refill, is_active, sort_order, number_of_ips, duration_days, discount_price, availability_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        product.name,
        product.description,
        product.proxy_type,
        product.location,
        product.image_url ?? null,
        JSON.stringify(product.features ?? []),
        product.pricing_unit ?? 'ip',
        (product.supports_cd_key ?? true) ? 1 : 0,
        (product.supports_account_refill ?? true) ? 1 : 0,
        product.is_active ? 1 : 0,
        product.sort_order ?? 0,
        product.number_of_ips ?? null,
        product.duration_days ?? null,
        product.discount_price ?? null,
        product.availability_status ?? 'available',
      ],
    );
    const insertId = (result as any).insertId;
    // insert any provided product_prices and sync plans based on prices
    if ((product as any).prices && Array.isArray((product as any).prices)) {
      const prices = (product as any).prices as Array<any>;
      let sort = 0;
      for (const raw of prices) {
        const p = {
          number_of_ips: Number(raw.number_of_ips ?? 0),
          price: Number(raw.price ?? 0),
          currency: raw.currency ?? 'GHS',
        };
        await conn.query('INSERT INTO product_prices (product_id, number_of_ips, price, currency, sort_order) VALUES (?, ?, ?, ?, ?)', [insertId, p.number_of_ips, p.price, p.currency, sort]);
        // also create a corresponding plan so existing order flow can reference plan_id
        await conn.query('INSERT INTO plans (product_id, name, price, currency, is_active, sort_order, number_of_ips) VALUES (?, ?, ?, ?, ?, ?, ?)', [insertId, `${p.number_of_ips} IPs`, p.price, p.currency, 1, sort, p.number_of_ips]);
        sort += 1;
      }
    }
    await conn.commit();
    const [rows] = await conn.query('SELECT * FROM products WHERE id = ? LIMIT 1', [insertId]);
    return normalizeProduct((rows as ProductRow[])[0]);
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateProduct(productId: number, patch: Partial<Record<string, any>>) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const allowedFields = new Set([
      'slug', 'name', 'description', 'proxy_type', 'location', 'image_url', 'features', 'pricing_unit', 'supports_cd_key', 'supports_account_refill', 'is_active', 'sort_order', 'number_of_ips', 'duration_days', 'discount_price', 'availability_status',
    ]);
    const fields: string[] = [];
    const params: any[] = [];
    for (const [k, v] of Object.entries(patch)) {
      // `prices` is handled separately below; don't include it in the products update SQL
      if (k === 'prices') continue;
      if (!allowedFields.has(k)) {
        console.warn('Ignoring unknown product field in update:', k);
        continue;
      }
      // coerce types for certain fields
      if (k === 'features') {
        params.push(JSON.stringify(v ?? []));
      } else if (k === 'is_active' || k === 'supports_cd_key' || k === 'supports_account_refill') {
        params.push(v ? 1 : 0);
      } else {
        params.push(v);
      }
      fields.push(`${k} = ?`);
    }
    if (fields.length > 0) {
      params.push(productId);
      const sql = `UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
      try {
        await conn.query(sql, params);
      } catch (err) {
        console.error('Failed SQL:', sql);
        console.error('Params:', params);
        throw err;
      }
    }
    // If prices provided, replace existing product_prices and sync plans
    if (patch.prices && Array.isArray(patch.prices)) {
      // delete existing product_prices and plans for this product
      await conn.query('DELETE FROM product_prices WHERE product_id = ?', [productId]);
      await conn.query('DELETE FROM plans WHERE product_id = ?', [productId]);
      let sort = 0;
      for (const raw of patch.prices) {
        const p = {
          number_of_ips: Number(raw.number_of_ips ?? 0),
          price: Number(raw.price ?? 0),
          currency: raw.currency ?? 'GHS',
        };
        await conn.query('INSERT INTO product_prices (product_id, number_of_ips, price, currency, sort_order) VALUES (?, ?, ?, ?, ?)', [productId, p.number_of_ips, p.price, p.currency, sort]);
        await conn.query('INSERT INTO plans (product_id, name, price, currency, is_active, sort_order, number_of_ips) VALUES (?, ?, ?, ?, ?, ?, ?)', [productId, `${p.number_of_ips} IPs`, p.price, p.currency, 1, sort, p.number_of_ips]);
        sort += 1;
      }
    }
    await conn.commit();
    const [rows] = await conn.query('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
    return normalizeProduct((rows as ProductRow[])[0]);
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    throw err;
  } finally {
    conn.release();
  }
}

export async function softDeleteProduct(productId: number) {
  await pool.query('UPDATE products SET is_active = 0, updated_at = NOW() WHERE id = ?', [productId]);
  return true;
}

export async function createPlan(productId: number, plan: { name: string; price: number; currency?: string; is_active?: boolean; sort_order?: number; number_of_ips?: number | null }) {
  const [result] = await pool.query(
    'INSERT INTO plans (product_id, name, price, currency, is_active, sort_order, number_of_ips) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [productId, plan.name, plan.price, plan.currency ?? 'GHS', plan.is_active ? 1 : 1, plan.sort_order ?? 0, plan.number_of_ips ?? null],
  );
  const insertId = (result as any).insertId;
  const [rows] = await pool.query('SELECT * FROM plans WHERE id = ? LIMIT 1', [insertId]);
  return normalizePlan((rows as PlanRow[])[0]);
}

export async function updatePlan(planId: number, patch: Partial<{ name: string; price: number; currency: string; is_active: boolean; sort_order: number; number_of_ips?: number | null }>) {
  const fields: string[] = [];
  const params: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    params.push(v);
  }
  if (fields.length === 0) return null;
  params.push(planId);
  await pool.query(`UPDATE plans SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
  const [rows] = await pool.query('SELECT * FROM plans WHERE id = ? LIMIT 1', [planId]);
  return normalizePlan((rows as PlanRow[])[0]);
}

export async function deletePlan(planId: number) {
  await pool.query('DELETE FROM plans WHERE id = ?', [planId]);
  return true;
}
