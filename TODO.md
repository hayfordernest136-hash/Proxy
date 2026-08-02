# Tracking Improvements - TODO

## Task (Prior)

When tracking a data order, require BOTH the order number AND contact number, and fetch live status from the Rema API to know when orders are marked as paid or delivered.

## Steps (Prior - mostly done)

### Backend - `server/src/controllers/data.controller.ts`

- [x] 1. Import `updateOrder` from `../services/order.service`
- [x] 2. Modify `trackDataOrderHandler` to require BOTH orderId AND contactNumber (400 error if either missing)
- [x] 3. Look up order by order number, then verify contact number matches stored delivery/contact info (404 if mismatch)
- [x] 4. After fetching Rema status via `fetchRemaOrderStatus`, sync the local order status:
  - [x] delivered/success/completed/fulfilled → mark local `completed` + `delivered` + create order event
  - [x] failed/cancelled/refunded/error → mark local `failed`
  - [x] processing + already paid → mark local `processing`
- [x] 5. Return the live Rema status info in the response payload

### Frontend - `src/routes/data/track.tsx`

- [x] 6. Require BOTH order ID and contact number to submit (update validation/error message)
- [x] 8. Auto-tracking useEffect only fires when both fields present
- [x] 9. Update helper texts and empty-state copy

## Task (New) - Admin "Open" Button: Data orders read-only + Rema sync

## Goal

When an admin clicks "Open" on an order in Admin Order Management, detect the order type:

- **DATA BUNDLE** → show a read-only details page, status synced ONLY from the Rema Data API (no manual management controls).
- **PROXY** → keep the existing management interface unchanged.

## Steps

### Backend - `server/src/controllers/admin.controller.ts`

- [x] 1. Enhance `getAdminOrderRemaStatusHandler` sync so Rema is always the source of truth for Data orders:
  - [x] a. Map `refunded` → local status `refunded` + delivery_status `refunded`
  - [x] b. Map `delivered/completed/success/fulfilled` → `completed` + `delivered`
  - [x] c. Map `failed/cancelled/error/rejected` → `failed` + `failed`
  - [x] d. Map `pending/processing/paid/queued/active/in progress` → `processing` + `pending`
  - [x] e. Update local DB (status, delivery_status, fulfillment_reference) whenever it differs from Rema
  - [x] f. Always log an order event when status changes
- [x] 2. Add a guard in `updateOrderHandler` so manual PATCH status/delivery changes on **Data orders** are rejected (403). Proxy orders remain fully manageable.

### Frontend - `src/routes/_authenticated/admin/orders/$orderId.tsx`

- [x] 3. `payment_reference` / `payment_provider` already present in `AdminOrder` interface
- [x] 4. For **Data orders**, renders a clean read-only details page:
  - [x] a. Notice banner: "This order is managed automatically by the Rema Data API. Status updates cannot be changed manually."
  - [x] b. NO status dropdown / Save / Complete / Refund / Cancel / Change Status controls (Admin actions card is hidden for data orders)
  - [x] c. Shows 16 fields: BrokeFlex Order ID, Rema Data Reference, Rema Order Reference, Rema Client Reference, Customer Name, Customer Email, Customer Phone Number, Network, Bundle Size, Amount Paid, Delivery Number, Payment Status, Order Status, Delivery Status, Payment Reference, Date Created
  - [x] d. Timeline / Order History remains visible
  - [x] e. Auto-refresh Rema status every 15s (already configured)
- [x] 5. **Proxy order** UI stays exactly as-is (Admin actions card with status dropdown/Save/CD key/Delivery status all unchanged)

## Testing

- [x] 6. Backend auto-restarts via ts-node-dev; no compile errors
- [ ] 7. Visit `http://localhost:5173/admin/orders` and open a Data order → read-only view with live Rema status
- [ ] 8. Open a Proxy order → existing management controls remain unchanged
