function normalizeNetwork(value: string) {
  const normalized = String(value || "mtn")
    .trim()
    .toLowerCase();
  if (normalized === "mtn") return "mtn";
  if (normalized === "telecel" || normalized === "tigo" || normalized === "telex") return "telecel";
  if (normalized === "airteltigo" || normalized === "airtel" || normalized === "airtel-tigo")
    return "airteltigo";
  return normalized || "mtn";
}

function parsePrice(text: string) {
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  return Number(match[1]);
}

function extractPrices(html: string) {
  const values = Array.from(html.matchAll(/₵\s*([0-9]+(?:\.[0-9]+)?)/gi)).map((match) =>
    parsePrice(match[1]),
  );
  return values.filter((value): value is number => value !== null);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeBundleSizeLabel(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return raw;

  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(/^(\d+(?:\.\d+)?)(GB|MB|TB)$/i);
  if (!match) return raw;

  const numeric = Number.parseFloat(match[1]);
  const normalizedNumber = Number.isInteger(numeric)
    ? String(numeric)
    : String(numeric)
        .replace(/(\.\d*?[1-9])0+$/g, "$1")
        .replace(/\.0+$/g, "");
  const suffix = match[2].toUpperCase();

  return `${normalizedNumber}${suffix}`;
}

export function parsePublicRemaBundlesPage(html: string, network: string) {
  const targetNetwork = normalizeNetwork(network);
  const lowerHtml = html.toLowerCase();
  const sectionIndex = lowerHtml.indexOf(targetNetwork);

  if (sectionIndex === -1) {
    return [];
  }

  const sectionStart = Math.max(0, sectionIndex - 500);
  const sectionEnd = Math.min(html.length, sectionIndex + 6000);
  const sectionHtml = html.slice(sectionStart, sectionEnd);

  const bundles: Array<{
    id: string;
    name: string;
    volume: string;
    price: number;
    currency: string;
    network: string;
    reference: string;
    description: string;
  }> = [];
  const sizeMatches = Array.from(sectionHtml.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*(gb|gbs?)\b/gi));
  const prices = extractPrices(sectionHtml);

  for (const [index, match] of sizeMatches.entries()) {
    const qty = match[1];
    const normalizedQty = Number.parseFloat(qty).toString();
    const volume = normalizeBundleSizeLabel(`${normalizedQty}GB`);
    const price = prices[index] ?? prices[0] ?? null;
    if (!price) continue;

    const name = volume;
    const id = `${targetNetwork}-${slugify(name)}`;
    bundles.push({
      id,
      name,
      volume,
      price,
      currency: "GHS",
      network: targetNetwork,
      reference: id,
      description: "",
    });
  }

  return bundles;
}
