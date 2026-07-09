import { formatINR } from "@/lib/products";
import { siteConfig } from "@/lib/site-config";
import type { OrderEmailData } from "../types";
import { brand, emailLayout, escapeHtml, itemsTableHtml, totalsTableHtml } from "./layout";

export function internalNotificationEmail(order: OrderEmailData) {
  const addressLines = [
    order.shippingAddressLine1,
    order.shippingAddressLine2,
    `${order.shippingCity}, ${order.shippingState} - ${order.shippingPincode}`,
  ]
    .filter(Boolean)
    .map((l) => escapeHtml(l as string))
    .join("<br />");

  const bodyHtml = `
    <h1 style="margin:0 0 4px; font-family: Georgia, 'Times New Roman', serif; font-size:22px; color:${brand.foreground};">
      New order — ${escapeHtml(order.orderNumber)}
    </h1>
    <p style="margin:0 0 20px; color:${brand.muted};">
      ${new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}
    </p>

    ${itemsTableHtml(order.items, formatINR)}
    ${totalsTableHtml(order, formatINR)}

    <h2 style="margin:24px 0 8px; font-family: Georgia, 'Times New Roman', serif; font-size:16px; color:${brand.foreground};">
      Customer
    </h2>
    <p style="margin:0; color:${brand.foreground};">
      ${escapeHtml(order.shippingName)}<br />
      ${escapeHtml(order.shippingPhone)}${order.customerEmail ? ` &middot; ${escapeHtml(order.customerEmail)}` : ""}<br />
      ${addressLines}
    </p>

    ${
      order.orderNotes
        ? `<div style="margin-top:16px; padding:12px 14px; background-color:${brand.secondary}; border-radius:6px;">
             <strong style="color:${brand.foreground};">Order notes:</strong>
             <span style="color:${brand.foreground};"> ${escapeHtml(order.orderNotes)}</span>
           </div>`
        : ""
    }
    ${
      order.giftMessage
        ? `<div style="margin-top:12px; padding:12px 14px; background-color:${brand.secondary}; border-radius:6px;">
             <strong style="color:${brand.foreground};">Gift message:</strong>
             <span style="color:${brand.foreground};"> ${escapeHtml(order.giftMessage)}</span>
           </div>`
        : ""
    }

    <p style="margin:24px 0 0; color:${brand.muted}; font-size:13px;">
      View and manage this order in the Supabase Studio table editor (orders table).
    </p>
  `;

  return {
    subject: `New order ${order.orderNumber} — ${formatINR(order.total)}`,
    html: emailLayout({
      previewText: `New order ${order.orderNumber} from ${order.shippingName} — ${formatINR(order.total)}`,
      bodyHtml,
      siteUrl: siteConfig.url,
    }),
    text: internalNotificationText(order),
  };
}

function internalNotificationText(order: OrderEmailData) {
  const lines = order.items
    .map((l) => `- ${l.productName} (${l.size}) x${l.quantity} — ${formatINR(l.unitPrice * l.quantity)}`)
    .join("\n");
  const address = [
    order.shippingAddressLine1,
    order.shippingAddressLine2,
    `${order.shippingCity}, ${order.shippingState} - ${order.shippingPincode}`,
  ]
    .filter(Boolean)
    .join(", ");

  return `New order — ${order.orderNumber}
${new Date(order.createdAt).toLocaleString("en-IN")}

${lines}

Subtotal: ${formatINR(order.subtotal)}
Shipping: ${order.shippingFee === 0 ? "Free" : formatINR(order.shippingFee)}
Total: ${formatINR(order.total)}

Customer: ${order.shippingName}
Phone: ${order.shippingPhone}${order.customerEmail ? `\nEmail: ${order.customerEmail}` : ""}
Address: ${address}
${order.orderNotes ? `\nOrder notes: ${order.orderNotes}` : ""}${order.giftMessage ? `\nGift message: ${order.giftMessage}` : ""}
`;
}
