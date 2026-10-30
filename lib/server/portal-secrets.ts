import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { portalEncryptionKey } from "./config";

function userKey(userId: string) {
  return createHmac("sha256", portalEncryptionKey()).update(`futminna-portal:${userId}`).digest();
}

export function encryptPortalSecret(userId: string, plaintext: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", userKey(userId), nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${nonce.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptPortalSecret(userId: string, envelope: string) {
  const [version, nonceHex, tagHex, ciphertextHex] = envelope.split(":");
  if (version !== "v1" || !nonceHex || !tagHex || !ciphertextHex) throw new Error("Invalid encrypted portal secret.");
  const decipher = createDecipheriv("aes-256-gcm", userKey(userId), Buffer.from(nonceHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]).toString("utf8");
}
