export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Server authentication and database settings are not configured.");
  }
  return { url: url.replace(/\/$/, ""), anonKey, serviceKey };
}

export function portalEncryptionKey() {
  const encoded = process.env.PORTAL_DATA_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Portal data encryption is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("Portal data encryption key must be 32 bytes.");
  return key;
}
