type ParseResult = { quantity: number; unit?: string; price: number; currency?: string };

function normalizeUnit(unit?: string) {
  const value = unit?.trim().toLowerCase();
  if (!value) return undefined;
  if (["ip", "ips", "ipv4", "ipv6"].includes(value)) return "ip";
  if (["gb", "gbs"].includes(value)) return "gb";
  return value;
}

const SmartPricingParser = {
  parse(input: string, fallbackUnit?: string): ParseResult[] {
    const lines = input
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);

    const results: ParseResult[] = [];

    for (const line of lines) {
      const patterns = [
        /^(\d+(?:\.\d+)?)\s*([A-Za-z%]+)?\s*(?:=|:|->)\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?$/i,
        /^(\d+(?:\.\d+)?)\s*([A-Za-z%]+)?\s*,\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?$/i,
        /^(\d+(?:\.\d+)?)\s*([A-Za-z%]+)?\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)?$/i,
      ];

      let matched = false;

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (!match) continue;

        const [, quantityText, unitText, priceText, currencyText] = match;
        const quantity = Number(quantityText);
        const price = Number(priceText);

        if (!Number.isNaN(quantity) && !Number.isNaN(price)) {
          results.push({
            quantity,
            unit: normalizeUnit(unitText ?? fallbackUnit),
            price,
            currency: currencyText?.trim().toUpperCase(),
          });
          matched = true;
          break;
        }
      }

      if (matched) continue;

      const parts = line.split(/=|:|,|\s+/).map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) continue;

      const qtyText = parts[0];
      const priceText = parts[1];
      const qty = Number(qtyText);
      const price = Number(priceText);

      if (!Number.isNaN(qty) && !Number.isNaN(price)) {
        results.push({
          quantity: qty,
          unit: normalizeUnit(fallbackUnit),
          price,
        });
      }
    }

    return results;
  },
};

export default SmartPricingParser;
