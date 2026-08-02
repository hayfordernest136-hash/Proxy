import { createFileRoute } from "@tanstack/react-router";
import { Clock, LifeBuoy, MessageCircle } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support Center - BrokeFlex Data" },
      {
        name: "description",
        content:
          "Contact our support team through WhatsApp for help with data bundles, proxy orders, payments, and account issues.",
      },
      { property: "og:title", content: "Support Center - BrokeFlex Data" },
      {
        property: "og:description",
        content:
          "Get help with data bundles, proxy orders, payments, and account issues through WhatsApp support.",
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <SiteLayout>
      <section className="hero-glow border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-tight">Support Center</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Need help? We are here for you. Whether you bought a data bundle or a proxy plan, our
              team is ready to assist with your orders, payments and account. Reach out to us
              directly on WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm text-muted-foreground">
                <MessageCircle className="size-4 text-primary" />
                WhatsApp support
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70">
          <CardContent className="space-y-5 p-8">
            <div className="flex items-center gap-2 text-primary">
              <MessageCircle className="size-5" />
              <h2 className="text-xl font-semibold tracking-tight">Contact Support</h2>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              Click the WhatsApp button below to chat with us directly. Our support team helps
              customers with every service we offer, including data bundles and proxies.
            </p>
            <div className="rounded-xl border border-border/70 bg-muted/50 p-4">
              <p className="text-sm font-medium text-foreground">We can help you with:</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Data bundle purchases</li>
                <li>Failed transactions</li>
                <li>Delayed deliveries</li>
                <li>Proxy orders</li>
                <li>Proxy setup issues</li>
                <li>Account and wallet issues</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/50 p-4">
              <p className="text-sm font-medium text-foreground">
                When contacting support, please provide:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Your name</li>
                <li>Email address or account details</li>
                <li>A description of your issue</li>
                <li>Screenshots or error messages, if available</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="space-y-5 p-8">
            <div className="flex items-center gap-2 text-primary">
              <LifeBuoy className="size-5" />
              <h2 className="text-xl font-semibold tracking-tight">Support Details</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Support Hours:</span> We respond as
                quickly as possible and aim to resolve customer issues promptly.
              </p>
              <p>
                <span className="font-medium text-foreground">
                  Thank you for using our service.
                </span>{" "}
                We appreciate your trust and support.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            We respond as quickly as possible and aim to resolve customer issues promptly.
          </p>
        </div>
      </section>
      <WhatsAppButton />
    </SiteLayout>
  );
}
