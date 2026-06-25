// Dev-only: generate app icons from the official logo-icon.png. The source has
// large transparent padding (mark ~15% of frame), so we trim it then fit into a
// square with a small consistent margin — the artwork/proportions of the mark
// itself are preserved, only the surrounding empty space is normalised.
import sharp from "sharp";

const src = "public/brand/logo-icon.png";

async function make(out, size, pad) {
  const inner = size - pad * 2;
  const mark = await sharp(src)
    .trim()
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

await make("src/app/icon.png", 256, 26);
await make("src/app/apple-icon.png", 180, 16);
