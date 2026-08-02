export type DataCartItem = {
  id: string;
  network: string;
  bundle: string;
  price: number;
  currency: string;
  deliveryNumber: string;
  createdAt: number;
};

const CART_STORAGE_KEY = "proxyy2-data-cart";

function readItems(): DataCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DataCartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getDataCartItems() {
  return readItems();
}

export function saveDataCartItems(items: DataCartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function addDataCartItem(item: DataCartItem) {
  const items = readItems();
  const next = [item, ...items];
  saveDataCartItems(next);
  return next;
}

export function updateDataCartItem(itemId: string, updates: Partial<DataCartItem>) {
  const items = readItems();
  const next = items.map((item) => (item.id === itemId ? { ...item, ...updates } : item));
  saveDataCartItems(next);
  return next;
}

export function removeDataCartItem(itemId: string) {
  const items = readItems();
  const next = items.filter((item) => item.id !== itemId);
  saveDataCartItems(next);
  return next;
}

export function clearDataCartItems() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_STORAGE_KEY);
}

export function formatGhanaPhone(value: string) {
  return value.replace(/\s+/g, "").replace(/[^\d+]/g, "");
}

export function isValidGhanaPhoneNumber(value: string) {
  const normalized = formatGhanaPhone(value);
  return /^(?:\+233|233|0)(?:2|3|5|7|8|9)\d{8}$/.test(normalized);
}
