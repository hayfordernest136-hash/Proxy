import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data — Brokeflex Data" },
      {
        name: "description",
        content: "Data purchases will be available soon.",
      },
      { property: "og:title", content: "Data — Brokeflex Data" },
      {
        property: "og:description",
        content: "Data purchases will be available soon.",
      },
    ],
  }),
  component: DataPage,
});

function DataPage() {
  return (
    <SiteLayout>
      <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 py-24 sm:px-6">
        <div className="w-full rounded-3xl border border-green-200 bg-green-50 p-12 text-center shadow-sm dark:border-green-800 dark:bg-green-950/30">
          <h1 className="text-4xl font-extrabold tracking-tight text-green-700 dark:text-green-400">
            Coming Soon!
          </h1>
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-green-600 dark:text-green-300">
            Data purchases will be available soon. We are currently preparing this
            feature. Stay tuned!
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}

