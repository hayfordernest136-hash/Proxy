import React, { useState } from "react";
import SmartPricingParser from "./SmartPricingParser";

// Local minimal type to avoid coupling on shared types during scaffold
type ProductPrice = {
  id: number | string;
  number_of_ips: number;
  price: number;
  currency: string;
  sort_order?: number;
};

type PricingEditorProps = {
  initial?: ProductPrice[];
  onChange?: (prices: ProductPrice[]) => void;
};

export default function PricingEditor({ initial = [], onChange }: PricingEditorProps) {
  const [rows, setRows] = useState<ProductPrice[]>(
    initial.map((r, i) => ({ ...r, id: r.id ?? i }))
  );
  const [bulkText, setBulkText] = useState("");

  function handleParse(text: string) {
    const parsed = SmartPricingParser.parse(text);
    const next = parsed.map((p, i) => ({ id: Date.now() + i, number_of_ips: p.quantity, price: p.price, currency: p.currency ?? "GHS", sort_order: i }));
    setRows(next);
    onChange?.(next);
  }

  function handleRowChange(idx: number, patch: Partial<ProductPrice>) {
    const copy = [...rows];
    copy[idx] = { ...copy[idx], ...patch };
    setRows(copy);
    onChange?.(copy);
  }

  function addRow() {
    const next = [...rows, { id: Date.now(), number_of_ips: 1, price: 0, currency: "GHS", sort_order: rows.length }];
    setRows(next);
    onChange?.(next);
  }

  function removeRow(idx: number) {
    const copy = rows.filter((_, i) => i !== idx);
    setRows(copy);
    onChange?.(copy);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Quick pricing (paste multiple lines)</label>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={`10ip = 20\n25ip=45\n50ip=80`}
          className="w-full mt-2 rounded border p-2 text-sm"
          rows={6}
        />
        <div className="mt-2 flex gap-2">
          <button
            className="px-3 py-2 rounded bg-primary text-primary-foreground"
            onClick={() => handleParse(bulkText)}
          >
            Generate Pricing
          </button>
          <button
            className="px-3 py-2 rounded border"
            onClick={() => { setBulkText(""); }}
          >
            Clear
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Pricing rows</h3>
          <button className="text-sm text-muted-foreground" onClick={addRow}>Add row</button>
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className="flex gap-2 items-center">
              <input type="number" value={r.number_of_ips} onChange={(e) => handleRowChange(i, { number_of_ips: Number(e.target.value) })} className="w-24 rounded border p-1" />
              <input type="number" value={r.price} onChange={(e) => handleRowChange(i, { price: Number(e.target.value) })} className="w-28 rounded border p-1" />
              <input value={r.currency} onChange={(e) => handleRowChange(i, { currency: e.target.value })} className="w-20 rounded border p-1" />
              <button className="px-2 py-1 rounded border text-sm" onClick={() => removeRow(i)}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
