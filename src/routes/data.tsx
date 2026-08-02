import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data Store - BrokeFlex Data" },
      {
        name: "description",
        content:
          "Get live data bundles from MTN, Telecel, and AirtelTigo with instant Paystack checkout.",
      },
      { property: "og:title", content: "Data Store - BrokeFlex Data" },
      {
        property: "og:description",
        content: "Buy instant data bundles without creating an account.",
      },
    ],
  }),
  component: () => <Outlet />,
});
