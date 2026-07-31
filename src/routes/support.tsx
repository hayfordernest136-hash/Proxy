import { createFileRoute } from "@tanstack/react-router";
import { Clock, KeyRound, LifeBuoy, Mail, RefreshCw } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { DELIVERY_DISCLAIMER } from "@/lib/order-status";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support & FAQ — BrokeFlex" },
      {
        name: "description",
        content:
          "Delivery times, payment help and answers to common questions about buying proxies from BrokeFlex.",
      },
      { property: "og:title", content: "Support & FAQ — BrokeFlex" },
      {
        property: "og:description",
        content: "Delivery times, payment help and common questions answered.",
      },
    ],
  }),
  component: SupportPage,
});

const FAQ = [
  {
    q: "How fast will I receive my proxy?",
    a: "CD Key orders are usually delivered within 2 minutes of payment. Account refill orders usually take 5-7 minutes. You can watch progress live on your order page.",
  },
  {
    q: "What does \"Purchasing Proxy\" mean on my order?",
    a: "It means we have received your payment and are currently buying or topping up the proxy with the supplier before delivering it to you. Your order will move to Delivering as soon as that is done.",
  },
  {
    q: "Do I need an account to buy?",
    a: "Yes. An account lets us deliver your CD key securely, keep your order history and notify you whenever the status changes.",
  },
  {
    q: "Which payment methods do you accept?",
    a: "We accept payments through Paystack, which supports mobile money and cards in Ghana. Additional providers are being added.",
  },
  {
    q: "Is my account password safe for refill orders?",
    a: "Only our fulfilment team can view refill credentials, and they are never exposed to other customers. Leave the password blank whenever your provider does not require it.",
  },
  {
    q: "Can I get a refund?",
    a: "If we cannot fulfil your order, we cancel and refund it. Reach out from your dashboard and our team will handle it.",
  },
];

function SupportPage() {
  return (
    <SiteLayout>
      <section className="hero-glow border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Support</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            # Support Center

Need help? We are here to assist you.

If you have any questions, problems, or need assistance with your account, payments, or services, contact us directly through WhatsApp. Our support team will personally respond and help you resolve your issue.

## Contact Support

💬 WhatsApp Support
Click the WhatsApp button below to chat with us directly.

 We Can Help With:

* Account and login issues
* Payment problems
* Service questions
* Order or subscription issues
* Technical difficulties
* General inquiries

When Contacting Support, Please Provide:

Your name
 Email address or account details
 A description of your issue
 Screenshots or error messages (if applicable)

Support Hours

We respond as quickly as possible and aim to resolve customer issues promptly.

Thank you for using our service. We appreciate your trust and support.

          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
        {[
          {
            icon: KeyRound,
            title: "CD Key delivery",
            body: "Usually within 2 minutes after payment.",
          },
          {
            icon: RefreshCw,
            title: "Account refill",
            body: "Usually within 5-7 minutes after payment.",
          },
          {
            icon: Mail,
            title: "Email us",
            body: "support@brokeflex.example — replies within a few hours.",
          },
        ].map((c) => (
          <Card key={c.title} className="border-border/70">
            <CardContent className="space-y-3 p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                <c.icon className="size-5" />
              </span>
              <h2 className="font-semibold tracking-tight">{c.title}</h2>
              <p className="text-sm text-muted-foreground">{c.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LifeBuoy className="size-5 text-primary" /> Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="mt-6">
          {FAQ.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="mt-8 flex items-start gap-2 text-sm text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" />
          {DELIVERY_DISCLAIMER}
        </p>
      </section>
    </SiteLayout>
  );
}
