// Shared table-based HTML shell for transactional emails. Inline styles only —
// email clients don't support external stylesheets or most CSS. Brand colors
// match src/app/globals.css (light theme values, since email always renders light).

export const brand = {
  background: "#faf6f0",
  foreground: "#3a322c",
  primary: "#6f6258",
  secondary: "#ece4d8",
  muted: "#7a6f63",
  accent: "#8a6a3a",
  border: "#e3dac9",
  card: "#ffffff",
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailLayout(params: {
  previewText: string;
  bodyHtml: string;
  siteUrl: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>Velmaya</title>
<!--[if mso]>
<style>* { font-family: Georgia, 'Times New Roman', serif !important; }</style>
<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:${brand.background}; font-family: Georgia, 'Times New Roman', serif;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(params.previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${brand.background};">
  <tr>
    <td align="center" style="padding: 32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; background-color:${brand.card}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
        <tr>
          <td align="center" style="background-color:${brand.primary}; padding: 28px 24px;">
            <span style="font-family: Georgia, 'Times New Roman', serif; font-size:24px; letter-spacing: 2px; color:${brand.background};">VELMAYA</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 28px; color:${brand.foreground}; font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size:15px; line-height:1.6;">
            ${params.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 28px; background-color:${brand.secondary}; text-align:center; font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size:12px; color:${brand.muted};">
            <p style="margin:0 0 6px;">Velmaya — Everyday ethnic wear, made to fit</p>
            <p style="margin:0;">
              <a href="${params.siteUrl}/policies/shipping" style="color:${brand.accent}; text-decoration:underline;">Shipping</a>
              &nbsp;·&nbsp;
              <a href="${params.siteUrl}/policies/returns" style="color:${brand.accent}; text-decoration:underline;">Returns</a>
              &nbsp;·&nbsp;
              <a href="${params.siteUrl}/contact" style="color:${brand.accent}; text-decoration:underline;">Contact</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function itemsTableHtml(
  items: { productName: string; size: string; unitPrice: number; quantity: number }[],
  formatINR: (n: number) => string
) {
  const rows = items
    .map(
      (l) => `
        <tr>
          <td style="padding: 10px 0; border-bottom:1px solid ${brand.border};">
            <span style="color:${brand.foreground};">${escapeHtml(l.productName)}</span>
            <span style="color:${brand.muted};"> (${escapeHtml(l.size)}) &times;${l.quantity}</span>
          </td>
          <td align="right" style="padding: 10px 0; border-bottom:1px solid ${brand.border}; white-space:nowrap; color:${brand.foreground};">
            ${formatINR(l.unitPrice * l.quantity)}
          </td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size:14px;">${rows}</table>`;
}

export function totalsTableHtml(
  totals: { subtotal: number; shippingFee: number; total: number },
  formatINR: (n: number) => string
) {
  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding: 4px 0; color:${brand.muted};">${label}</td>
      <td align="right" style="padding: 4px 0; color:${strong ? brand.foreground : brand.foreground}; font-weight:${strong ? 700 : 400};">${value}</td>
    </tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px; font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size:14px;">
    ${row("Subtotal", formatINR(totals.subtotal))}
    ${row("Shipping", totals.shippingFee === 0 ? "Free" : formatINR(totals.shippingFee))}
    <tr><td colspan="2" style="border-top:1px solid ${brand.border}; padding-top:8px;"></td></tr>
    ${row("Total", formatINR(totals.total), true)}
  </table>`;
}
