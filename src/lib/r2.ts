import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Cloudflare R2 is S3-API-compatible — we use the AWS SDK's S3 client
// pointed at R2's endpoint instead of a Cloudflare-specific SDK.
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!; // e.g. https://media.velmaya.com or the r2.dev URL

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getR2PublicUrl(key);
}

export function getR2PublicUrl(key: string) {
  return `${PUBLIC_BASE_URL}/${key}`;
}
