import { formatINR } from "@/lib/products";
import { siteConfig, whatsappLink } from "@/lib/site-config";
import type { OrderEmailData } from "../types";
import { brand, emailLayout, escapeHtml, itemsTableHtml, totalsTableHtml } from "./layout";

export function customerConfirmationEmail(order: OrderEmailData) {
  const support = whatsappLink(
    `Hi Velmaya! A question about my order ${order.orderNumber}.`
  );
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
      Thank you — your order is confirmed
    </h1>
    <p style="margin:0 0 20px; color:${brand.muted};">
      Order <strong style="color:${brand.foreground};">${escapeHtml(order.orderNumber)}</strong>
      &nbsp;·&nbsp;${new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
    </p>

    ${itemsTableHtml(order.items, formatINR)}
    ${totalsTableHtml(order, formatINR)}

    <h2 style="margin:24px 0 8px; font-family: Georgia, 'Times New Roman', serif; font-size:16px; color:${brand.foreground};">
      Shipping to
    </h2>
    <p style="margin:0; color:${brand.foreground};">
      ${escapeHtml(order.shippingName)}<br />
      ${addressLines}<br />
      ${escapeHtml(order.shippingPhone)}
    </p>

    ${
      order.giftMessage
        ? `<div style="margin-top:16px; padding:12px 14px; background-color:${brand.secondary}; border-radius:6px;">
             <strong style="color:${brand.foreground};">Gift message:</strong>
             <span style="color:${brand.foreground};"> ${escapeHtml(order.giftMessage)}</span>
           </div>`
        : ""
    }

    <p style="margin:24px 0 0; color:${brand.foreground};">
      We've reserved your pieces and will share tracking once they ship.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td style="border-radius:6px; background-color:${brand.accent};">
          <a href="${support}" style="display:inline-block; padding:12px 22px; color:${brand.background}; font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size:14px; font-weight:600; text-decoration:none;">
            Questions? Chat with us on WhatsApp
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Your Velmaya order ${order.orderNumber} is confirmed`,
    html: emailLayout({
      previewText: `Order ${order.orderNumber} confirmed — ${formatINR(order.total)}`,
      bodyHtml,
      siteUrl: siteConfig.url,
    }),
    text: customerConfirmationText(order),
  };
}

function customerConfirmationText(order: OrderEmailData) {
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

  return `Thank you — your order is confirmed

Order ${order.orderNumber} · ${new Date(order.createdAt).toLocaleDateString("en-IN")}

${lines}

Subtotal: ${formatINR(order.subtotal)}
Shipping: ${order.shippingFee === 0 ? "Free" : formatINR(order.shippingFee)}
Total: ${formatINR(order.total)}

Shipping to:
${order.shippingName}
${address}
${order.shippingPhone}
${order.giftMessage ? `\nGift message: ${order.giftMessage}\n` : ""}
We've reserved your pieces and will share tracking once they ship.

Questions? Message us: ${whatsappLink(`Hi Velmaya! A question about my order ${order.orderNumber}.`)}
`;
}
