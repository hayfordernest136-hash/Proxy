import React from "react";

export function ProductEditPlaceholder({ id }: { id?: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Edit Product {id ? `#${id}` : "(new)"}</h2>
      <p className="mt-2 text-sm text-muted-foreground">This is a UI scaffold for the dedicated edit page.</p>
      <div className="mt-4 grid grid-cols-12 gap-6">
        <section className="col-span-8">
          <div className="rounded border p-4">Product information form (placeholder)</div>
          <div className="rounded border p-4 mt-4">Pricing editor (placeholder)</div>
        </section>
        <aside className="col-span-4">
          <div className="rounded border p-4">Settings & Status (placeholder)</div>
        </aside>
      </div>
    </div>
  );
}

export default ProductEditPlaceholder;
