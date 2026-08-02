import React from "react";

export function ProductListPlaceholder() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Products (scaffold)</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This is a UI scaffold. We'll convert this to a router-backed page next.
      </p>
      <div className="mt-4 rounded border p-4">
        <p className="text-sm">Table and bulk actions will be implemented here.</p>
      </div>
    </div>
  );
}

export default ProductListPlaceholder;
