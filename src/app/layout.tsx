import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema, websiteSchema } from "@/lib/seo/schema";

const velmayaSerif = Fraunces({
  variable: "--font-velmaya-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const velmayaSans = Inter({
  variable: "--font-velmaya-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://velmaya.com"),
  title: {
    default: "Velmaya — Everyday Ethnic Wear",
    template: "%s · Velmaya",
  },
  description:
    "Kurtis, kurti sets, short kurtis and co-ord sets designed for everyday wear, sizes XS–2XL.",
  // app/icon.png + app/apple-icon.png (from the official mark) are auto-detected.
  openGraph: {
    title: "Velmaya — Everyday Ethnic Wear",
    description:
      "Everyday ethnic wear made to fit, sizes XS–2XL. Crafted in Tamil Nadu.",
    url: "https://velmaya.com",
    siteName: "Velmaya",
    images: [{ url: "/brand/logo-horizontal.png", width: 1672, height: 941 }],
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${velmayaSerif.variable} ${velmayaSans.variable} antialiased`}
      >
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
