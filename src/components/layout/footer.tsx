import Link from "next/link";
import { Mail } from "lucide-react";
import { InstagramIcon, WhatsappIcon } from "@/components/brand/icons";
import { BrandLogo } from "@/components/brand/brand-logo";
import { NewsletterForm } from "@/components/forms/newsletter-form";
import {
  footerNav,
  siteConfig,
  whatsappLink,
  instagramLink,
} from "@/lib/site-config";

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/60">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* brand + newsletter */}
          <div className="lg:col-span-2">
            <Link href="/" aria-label="Velmaya home" className="inline-block">
              <BrandLogo variant="reversed" className="h-20" />
            </Link>
            <p className="mt-4 max-w-sm text-sm text-primary-foreground/80">
              {siteConfig.description}
            </p>

            <NewsletterForm />

            <div className="mt-6 flex items-center gap-3">
              <a
                href={instagramLink()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="rounded-full border border-primary-foreground/25 p-2 transition-colors hover:bg-primary-foreground/10"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
              <a
                href={whatsappLink("Hi Velmaya! I'd like to know more.")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="rounded-full border border-primary-foreground/25 p-2 transition-colors hover:bg-primary-foreground/10"
              >
                <WhatsappIcon className="h-4 w-4" />
              </a>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                aria-label="Email"
                className="rounded-full border border-primary-foreground/25 p-2 transition-colors hover:bg-primary-foreground/10"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          <FooterColumn title="Shop" links={footerNav.shop} />
          <FooterColumn title="Company" links={footerNav.company} />
          <div className="space-y-8">
            <FooterColumn title="Support" links={footerNav.support} />
            <FooterColumn title="Legal" links={footerNav.legal} />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-primary-foreground/15 pt-6 text-xs text-primary-foreground/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Velmaya. All rights reserved.</p>
          <p>Crafted in Tamil Nadu, India · GSTIN [GSTIN]</p>
        </div>
      </div>
    </footer>
  );
}
