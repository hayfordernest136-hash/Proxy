import React, { useEffect, useState } from "react";
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
  const [generateMode, setGenerateMode] = useState<"replace" | "append" | "merge">("replace");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setRows(initial.map((r, i) => ({ ...r, id: r.id ?? i })));
  }, [initial]);

  function validatePriceRows(candidate: ProductPrice[]) {
    const errs: string[] = [];
    const qtys = new Set<number>();
    for (const r of candidate) {
      if (r.number_of_ips == null || Number.isNaN(Number(r.number_of_ips))) errs.push(`Invalid quantity: ${r.number_of_ips}`);
      if (r.price == null || Number.isNaN(Number(r.price))) errs.push(`Invalid price for ${r.number_of_ips}`);
      if (Number(r.price) < 0) errs.push(`Negative price for ${r.number_of_ips}`);
      if (qtys.has(Number(r.number_of_ips))) errs.push(`Duplicate quantity: ${r.number_of_ips}`);
      qtys.add(Number(r.number_of_ips));
    }
    return errs;
  }

  function applyParsed(parsed: { quantity: number; unit?: string; price: number; currency?: string }[]) {
    const newRows = parsed.map((p, i) => ({ id: Date.now() + i, number_of_ips: p.quantity, price: p.price, currency: p.currency ?? "GHS", sort_order: i }));
    let next: ProductPrice[] = [];
    if (generateMode === "replace") next = newRows;
    else if (generateMode === "append") next = [...rows, ...newRows];
    else {
      // merge: override rows with same quantity, otherwise append
      const map = new Map(rows.map((r) => [Number(r.number_of_ips), r]));
      for (const nr of newRows) map.set(Number(nr.number_of_ips), nr);
      next = Array.from(map.values()).sort((a, b) => Number(a.number_of_ips) - Number(b.number_of_ips));
    }
    const v = validatePriceRows(next);
    setErrors(v);
    if (v.length === 0) {
      setRows(next);
      onChange?.(next);
    }
  }

  function handleParse(text: string) {
    const parsed = SmartPricingParser.parse(text);
    applyParsed(parsed);
  }

  function handleRowChange(idx: number, patch: Partial<ProductPrice>) {
    const copy = [...rows];
    copy[idx] = { ...copy[idx], ...patch };
    const v = validatePriceRows(copy);
    setErrors(v);
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
        <div className="mt-2 flex items-center gap-2">
          <select value={generateMode} onChange={(e) => setGenerateMode(e.target.value as any)} className="rounded border p-1">
            <option value="replace">Replace</option>
            <option value="append">Append</option>
            <option value="merge">Merge</option>
          </select>
          <button
            className="px-3 py-2 rounded bg-primary text-primary-foreground"
            onClick={() => handleParse(bulkText)}
          >
            Quick Generate
          </button>
          <button
            className="px-3 py-2 rounded border"
            onClick={() => { setBulkText(""); }}
          >
            Clear
          </button>
        </div>
        {errors.length > 0 ? (
          <div className="mt-2 text-sm text-destructive">
            {errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Pricing rows</h3>
          <div className="flex items-center gap-2">
            <button className="text-sm text-muted-foreground" onClick={addRow}>Add row</button>
            <button className="text-sm text-muted-foreground" onClick={() => {
              // export JSON
              const data = JSON.stringify(rows, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'pricing.json'; a.click(); URL.revokeObjectURL(url);
            }}>Export JSON</button>
            <button className="text-sm text-muted-foreground" onClick={() => {
              // export CSV
              const csv = rows.map(r => `${r.number_of_ips},${r.price},${r.currency}`).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'pricing.csv'; a.click(); URL.revokeObjectURL(url);
            }}>Export CSV</button>
            <label className="text-sm text-muted-foreground cursor-pointer">
              Import JSON
              <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return; const txt = await f.text(); try { const parsed = JSON.parse(txt); if (Array.isArray(parsed)) { applyParsed(parsed.map((p:any,i:number)=>({quantity: Number(p.number_of_ips||p.quantity), price: Number(p.price), unit: undefined, currency: p.currency}))); } } catch(err){ setErrors([String(err)]); }
              }} />
            </label>
            <label className="text-sm text-muted-foreground cursor-pointer">
              Import CSV
              <input type="file" accept="text/csv" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return; const txt = await f.text(); const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
                const parsed = lines.map(l=>{ const parts = l.split(/,|;/).map(p=>p.trim()); return { quantity: Number(parts[0]), price: Number(parts[1]), currency: parts[2] }; }); applyParsed(parsed);
              }} />
            </label>
          </div>
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

      <div>
        <h4 className="text-sm font-medium">Live preview</h4>
        <div className="mt-2 bg-muted/20 p-3 rounded">
          {rows.length === 0 ? <div className="text-sm text-muted-foreground">No pricing</div> : rows.map((r) => (
            <div key={r.id} className="flex justify-between text-sm">
              <span>{r.number_of_ips} {r.number_of_ips === 1 ? 'IP' : 'IPs'}</span>
              <span>{r.currency} {r.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
