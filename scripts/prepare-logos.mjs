// Prepare display-ready logo assets from the official files in public/brand.
// The official exports carry 66–90% transparent padding, which makes height-based
// CSS sizing render the logo tiny. We trim that padding (proportions of the
// artwork are untouched — nothing is cropped or redrawn), add a small uniform
// margin for breathing room, and cap resolution for performance.
//
// Originals are left exactly as delivered; we only WRITE new "-fit" / mark files.
import sharp from "sharp";

async function trimToFit(name, { out, maxHeight, marginPct = 0.04 }) {
  const src = `public/brand/${name}.png`;
  const trimmed = await sharp(src)
    .trim()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = trimmed.info;
  const margin = Math.round(Math.max(width, height) * marginPct);

  let img = sharp(trimmed.data).extend({
    top: margin,
    bottom: margin,
    left: margin,
    right: margin,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  const finalHeight = height + margin * 2;
  if (finalHeight > maxHeight) {
    img = img.resize({ height: maxHeight });
  }

  const result = await img.png().toBuffer({ resolveWithObject: true });
  await sharp(result.data).toFile(`public/brand/${out}.png`);
  console.log(
    `${out}.png`.padEnd(24),
    `${result.info.width}x${result.info.height}`,
    `ratio ${(result.info.width / result.info.height).toFixed(2)}`
  );
}

await trimToFit("logo-horizontal", { out: "logo-horizontal-fit", maxHeight: 240 });
await trimToFit("logo-stacked", { out: "logo-stacked-fit", maxHeight: 420 });
await trimToFit("logo-reversed", { out: "logo-reversed-fit", maxHeight: 420 });
await trimToFit("logo-icon", { out: "logo-mark", maxHeight: 512, marginPct: 0.02 });
