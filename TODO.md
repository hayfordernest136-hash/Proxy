# Dual Pricing Model (Per IP / Per GB) — Implementation TODO

## Backend / Database

- [ ] 1. Update `server/sql/schema.sql` products table with new columns:
      `pricing_type`, `price_per_ip`, `price_per_gb`, `data_gb`
- [ ] 2. Add migration entries in `server/src/config/migrate.ts` schemaFixes for the new columns
- [ ] 3. Add backfill logic in `migrate.ts` to set `pricing_type` for existing products (IP/GB heuristics)
- [ ] 4. Update `seedSampleProducts` to include one IP product and one GB product (dev only)
- [ ] 5. Extend `server/src/services/product.service.ts`:
      - ProductRow type + normalizeProduct
      - createProduct / updateProduct to persist new fields
      - Sync a single plan per product (IP: price_per_ip × number_of_ips, GB: price_per_gb × data_gb)

## Frontend — Admin Dashboard

- [ ] 6. Update `src/routes/_authenticated/admin/index.tsx`:
      - Pricing Method selector (Per IP / Per GB) with conditional fields
      - Product list view columns: Product | Type | Pricing Model | Price | Duration

## Frontend — Product Display & Checkout

- [ ] 7. Update `src/routes/products/$slug.tsx`:
      - Display "10 Dedicated IPv4 IPs" / "10GB Residential Proxy"
      - Total calc: IP → price_per_ip × number_of_ips × qty; GB → price_per_gb × data_gb × qty
      - Legacy fallback when pricing_type missing
- [ ] 8. Update `src/components/site/ProductCard.tsx` to show correct package label/price
- [ ] 9. Update `src/routes/products/index.tsx` and `src/routes/pricing.tsx` to show from_price / package label correctly

## Verification

- [ ] 10. Run backend build (`npm run build` in server/)
- [ ] 11. Run frontend build (`npm run build` in root)
- [ ] 12. Verify migrations run without deleting existing data
- [ ] 13. Test: create IP product + GB product, verify checkout calc + admin view

