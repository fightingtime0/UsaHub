import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

// Cloudflare R2 — S3-compatible, tanpa biaya egress.
// Butuh bucket + API token (Account API Token dengan izin "Object Read & Write")
// dibuat di dashboard Cloudflare > R2 > Manage API Tokens.
const accountId = process.env.R2_ACCOUNT_ID!
const bucket = process.env.R2_BUCKET_NAME!

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )
  return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

// Ekstrak object key dari public URL tersimpan (untuk hapus saat ganti/hapus gambar)
export function r2KeyFromUrl(url: string): string | null {
  const base = process.env.R2_PUBLIC_URL
  if (!base || !url.startsWith(base)) return null
  return url.slice(base.length + 1)
}
