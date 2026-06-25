import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InstagramIcon, WhatsappIcon } from "@/components/brand/icons";
import {
  siteConfig,
  whatsappLink,
  instagramLink,
} from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Velmaya — WhatsApp, Instagram, or email. We reply fast.",
};

const channels = [
  {
    icon: WhatsappIcon,
    label: "WhatsApp",
    value: "+91 95970 75752",
    href: whatsappLink("Hi Velmaya! I have a question."),
    primary: true,
  },
  {
    icon: InstagramIcon,
    label: "Instagram",
    value: `@${siteConfig.contact.instagram}`,
    href: instagramLink(),
  },
  {
    icon: Mail,
    label: "Email",
    value: siteConfig.contact.email,
    href: `mailto:${siteConfig.contact.email}`,
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Get in touch"
        subtitle="Questions about sizing, your order, or just want to say hi? WhatsApp is the quickest way to reach us — we're a small team and we reply fast."
      />

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* channels */}
          <div className="space-y-4">
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("mailto") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-secondary"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <c.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm text-muted-foreground">
                    {c.label}
                  </span>
                  <span className="block font-medium text-foreground">
                    {c.value}
                  </span>
                </span>
              </a>
            ))}

            <p className="px-1 pt-2 text-sm text-muted-foreground">
              Velmaya · Tamil Nadu, India · GSTIN [GSTIN]
              <br />
              Business hours: Mon–Sat, 10am–7pm IST
            </p>
          </div>

          {/* form (fallback) */}
          <form className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-xl text-foreground">
              Send a message
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prefer not to use WhatsApp? Drop us a note.
            </p>
            <div className="mt-5 space-y-4">
              <Input type="text" required placeholder="Your name" />
              <Input type="email" required placeholder="Email address" />
              <Input type="text" placeholder="Order number (optional)" />
              <textarea
                required
                rows={4}
                placeholder="Your message"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" className="w-full">
                Send message
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                This form is wired to email/WhatsApp delivery in a later phase.
              </p>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
