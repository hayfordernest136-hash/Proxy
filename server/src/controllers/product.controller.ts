import { Request, Response } from 'express';
import {
  getActiveProducts,
  getPlansByProductId,
  getPlansByProductIds,
  getPricesByProductIds,
  getProductBySlug,
  ProductPlan,
} from '../services/product.service';

export async function listProducts(req: Request, res: Response) {
  try {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const products = await getActiveProducts(limit);
    const productIds = products.map((product) => product.id);
    const plans = await getPlansByProductIds(productIds);
    const prices = await getPricesByProductIds(productIds);
    const plansByProduct = plans.reduce<Record<number, ProductPlan[]>>((acc, plan) => {
      acc[plan.product_id] = acc[plan.product_id] ?? [];
      acc[plan.product_id].push(plan);
      return acc;
    }, {});

    const pricesByProduct = prices.reduce<Record<number, any[]>>((acc, p) => {
      acc[p.product_id] = acc[p.product_id] ?? [];
      acc[p.product_id].push(p);
      return acc;
    }, {});

    const payload = products.map((product) => ({
      ...product,
      plans: plansByProduct[product.id] ?? [],
      prices: pricesByProduct[product.id] ?? [],
    }));

    return res.json(payload);
  } catch (error) {
    console.error('Failed to list products:', error);
    return res.status(500).json({ message: 'Unable to load products' });
  }
}

export async function getProduct(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const product = await getProductBySlug(slug);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const plans = await getPlansByProductId(product.id);
    const prices = await getPricesByProductIds([product.id]);
    return res.json({ ...product, plans, prices: prices[0] ? prices : [] });
  } catch (error) {
    console.error('Failed to load product:', error);
    return res.status(500).json({ message: 'Unable to load product' });
  }
}
