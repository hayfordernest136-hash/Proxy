import { Request, Response } from 'express';
import {
  createProduct,
  updateProduct,
  softDeleteProduct,
  createPlan,
  updatePlan,
  deletePlan,
  getActiveProducts,
  getPlansByProductIds,
  getPricesByProductIds,
} from '../services/product.service';

export async function adminListProductsHandler(_req: Request, res: Response) {
  try {
    const products = await getActiveProducts();
    const productIds = products.map((p: any) => p.id);
    const plans = await getPlansByProductIds(productIds);
    const prices = await getPricesByProductIds(productIds);
    const plansByProduct = plans.reduce<Record<number, any[]>>((acc, plan) => {
      acc[plan.product_id] = acc[plan.product_id] ?? [];
      acc[plan.product_id].push(plan);
      return acc;
    }, {});

    const pricesByProduct = prices.reduce<Record<number, any[]>>((acc, p) => {
      acc[p.product_id] = acc[p.product_id] ?? [];
      acc[p.product_id].push(p);
      return acc;
    }, {});

    const payload = products.map((product: any) => ({ ...product, plans: plansByProduct[product.id] ?? [], prices: pricesByProduct[product.id] ?? [] }));
    return res.json(payload);
  } catch (error) {
    console.error('Failed to list admin products:', error);
    return res.status(500).json({ message: 'Unable to load products' });
  }
}

export async function adminCreateProductHandler(req: Request, res: Response) {
  try {
    const body = req.body;
    const product = await createProduct(body);
    return res.status(201).json(product);
  } catch (error) {
    console.error('Failed to create product:', error);
    return res.status(500).json({ message: 'Unable to create product' });
  }
}

export async function adminUpdateProductHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.productId);
    const patch = req.body;
    console.log(`adminUpdateProductHandler id=${id} bodyKeys=${Object.keys(patch).join(',')}`);
    try { console.log('adminUpdateProductHandler body:', JSON.stringify(patch).slice(0,1000)); } catch(e) {}
    const product = await updateProduct(id, patch);
    return res.json(product);
  } catch (error) {
    console.error('Failed to update product:', error);
    if ((error as any)?.stack) console.error((error as any).stack);
    return res.status(500).json({ message: 'Unable to update product' });
  }
}

export async function adminDeleteProductHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.productId);
    await softDeleteProduct(id);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete product:', error);
    return res.status(500).json({ message: 'Unable to delete product' });
  }
}

export async function adminCreatePlanHandler(req: Request, res: Response) {
  try {
    const productId = Number(req.params.productId);
    const body = req.body;
    const plan = await createPlan(productId, body);
    return res.status(201).json(plan);
  } catch (error) {
    console.error('Failed to create plan:', error);
    return res.status(500).json({ message: 'Unable to create plan' });
  }
}

export async function adminUpdatePlanHandler(req: Request, res: Response) {
  try {
    const planId = Number(req.params.planId);
    const patch = req.body;
    const plan = await updatePlan(planId, patch);
    return res.json(plan);
  } catch (error) {
    console.error('Failed to update plan:', error);
    return res.status(500).json({ message: 'Unable to update plan' });
  }
}

export async function adminDeletePlanHandler(req: Request, res: Response) {
  try {
    const planId = Number(req.params.planId);
    await deletePlan(planId);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete plan:', error);
    return res.status(500).json({ message: 'Unable to delete plan' });
  }
}

export default {};
