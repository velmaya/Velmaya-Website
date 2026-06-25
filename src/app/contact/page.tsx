import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "@/components/forms/contact-form";
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

          {/* form */}
          <ContactForm />
        </div>
      </section>
    </>
  );
}
