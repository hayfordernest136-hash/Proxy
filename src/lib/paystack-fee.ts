export const PAYSTACK_FEE_RATE = 0.0195;
export const PAYSTACK_FEE_CAP = Number(import.meta.env.VITE_PAYSTACK_FEE_CAP || '0') || null;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePaystackFee(originalAmount: number) {
  const amount = Number(originalAmount || 0);
  if (amount <= 0) {
    return { fee: 0, total: 0 };
  }

  const grossedTotal = amount / (1 - PAYSTACK_FEE_RATE);
  const rawFee = grossedTotal - amount;
  const fee = PAYSTACK_FEE_CAP !== null ? Math.min(rawFee, PAYSTACK_FEE_CAP) : rawFee;
  const roundedFee = roundMoney(fee);
  return {
    fee: roundedFee,
    total: roundMoney(amount + roundedFee),
  };
}
