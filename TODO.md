# Tracking Improvements - TODO

## Task
When tracking a data order, require BOTH the order number AND contact number, and fetch live status from the Rema API to know when orders are marked as paid or delivered.

## Steps

### Backend - `server/src/controllers/data.controller.ts`
- [ ] 1. Import `updateOrder` from `../services/order.service`
- [ ] 2. Modify `trackDataOrderHandler` to require BOTH orderId AND contactNumber (400 error if either missing)
- [ ] 3. Look up order by order number, then verify contact number matches stored delivery/contact info (404 if mismatch)
- [ ] 4. After fetching Rema status via `fetchRemaOrderStatus`, sync the local order status:
  - [ ] delivered/success/completed/fulfilled → mark local `completed` + `delivered` + create order event
  - [ ] failed/cancelled/refunded/error → mark local `failed`
  - [ ] processing + already paid → mark local `processing`
- [ ] 5. Return the live Rema status info in the response payload

### Frontend - `src/routes/data/track.tsx`
- [ ] 6. Require BOTH order ID and contact number to submit (update validation/error message)
- [ ] 8. Auto-tracking useEffect only fires when both fields present
- [ ] 9. Update helper texts and empty-state copy

## Testing
- [ ] 10. Restart backend (ts-node-dev auto-reloads), verify with curl
- [ ] 11. Test on http://localhost:5173/data/track

