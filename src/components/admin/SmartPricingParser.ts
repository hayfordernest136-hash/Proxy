type ParseResult = { quantity: number; unit?: string; price: number; currency?: string };

const SmartPricingParser = {
  parse(input: string): ParseResult[] {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const results: ParseResult[] = [];

    for (const line of lines) {
      // Accept forms: "10ip = 20", "10 IP=20", "10 GB = 5", "10ip=20usd"
      const parts = line.split(/=|:/).map((p) => p.trim());
      if (parts.length < 2) continue;
      const left = parts[0];
      const right = parts[1];

      // parse left -> quantity + unit
      const leftMatch = left.match(/^(\d+(?:\.\d+)?)(?:\s*([A-Za-z%]+))?$/);
      const qty = leftMatch ? Number(leftMatch[1]) : NaN;
      const unit = leftMatch && leftMatch[2] ? leftMatch[2] : undefined;

      // parse right -> price + optional currency
      const rightMatch = right.match(/^(\d+(?:\.\d+)?)(?:\s*([A-Za-z]+))?$/);
      const price = rightMatch ? Number(rightMatch[1]) : NaN;
      const currency = rightMatch && rightMatch[2] ? rightMatch[2].toUpperCase() : undefined;

      if (!isNaN(qty) && !isNaN(price)) results.push({ quantity: qty, unit, price, currency });
    }

    return results;
  },
};

export default SmartPricingParser;
