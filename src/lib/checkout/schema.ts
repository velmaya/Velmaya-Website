import { sizes, type Size } from "@/lib/site-config";

// Shipping/checkout input. Validation is plain functions (no extra deps) and is
// shared by the client form and the server action, so the server never trusts
// the client. Mirrors the hand-rolled pattern used by the contact form.

export type ShippingValues = {
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  orderNotes: string;
  giftMessage: string;
};

export type ShippingField = keyof ShippingValues;
export type ShippingErrors = Partial<Record<ShippingField, string>>;

export const emptyShipping: ShippingValues = {
  fullName: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  orderNotes: "",
  giftMessage: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(?:\+?91[-\s]?)?[6-9]\d{9}$/; // Indian mobile, optional +91
const PINCODE_RE = /^[1-9]\d{5}$/; // 6-digit Indian PIN, not starting 0

export function validateShipping(v: ShippingValues): ShippingErrors {
  const e: ShippingErrors = {};
  if (!v.fullName.trim()) e.fullName = "Please enter the recipient's name.";
  if (!PHONE_RE.test(v.phone.trim().replace(/\s/g, "")))
    e.phone = "Enter a valid 10-digit mobile number.";
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim()))
    e.email = "Enter a valid email address.";
  if (!v.addressLine1.trim()) e.addressLine1 = "Please enter your address.";
  if (!v.city.trim()) e.city = "Please enter your city.";
  if (!v.state.trim()) e.state = "Please enter your state.";
  if (!PINCODE_RE.test(v.pincode.trim()))
    e.pincode = "Enter a valid 6-digit PIN code.";
  if (v.giftMessage.length > 200)
    e.giftMessage = "Gift message is a little long (200 characters max).";
  if (v.orderNotes.length > 500)
    e.orderNotes = "Order notes are a little long (500 characters max).";
  return e;
}

// A single repriced cart line returned by the server.
export type RepricedLine = {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  size: Size;
  qty: number; // possibly reduced to available
  requestedQty: number;
  unitPrice: number; // current authoritative price
  previousUnitPrice: number; // what the client showed
  lineTotal: number;
  available: number;
  status: "ok" | "price_changed" | "qty_reduced" | "unavailable";
};

export type RepricedCart = {
  lines: RepricedLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
  hasChanges: boolean;
  hasPurchasable: boolean;
};

export function isSize(s: string): s is Size {
  return (sizes as readonly string[]).includes(s);
}
