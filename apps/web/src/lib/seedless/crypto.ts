const PRF_LABEL = "kairos-seedless-v1";
const HKDF_SALT = "kairos-seedless-hkdf-salt";
const HKDF_INFO = "kairos-seedless-keywrap";

const textEncoder = new TextEncoder();

const bytesToBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));

const base64ToBytes = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export const buildPrfInput = async (): Promise<Uint8Array> => {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(PRF_LABEL)
  );
  return new Uint8Array(hash);
};

export const extractPrfBytes = (authResponse: any): Uint8Array | null => {
  const prfResult =
    authResponse?.clientExtensionResults?.prf?.results?.first;
  if (!prfResult) return null;
  return prfResult instanceof ArrayBuffer
    ? new Uint8Array(prfResult)
    : prfResult;
};

const deriveAesKey = async (prfBytes: Uint8Array): Promise<CryptoKey> => {
  const prfBuffer = prfBytes.buffer.slice(
    prfBytes.byteOffset,
    prfBytes.byteOffset + prfBytes.byteLength
  ) as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    prfBuffer,
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: textEncoder.encode(HKDF_SALT),
      info: textEncoder.encode(HKDF_INFO),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const encryptSecret = async (
  secret: string,
  prfBytes: Uint8Array
) => {
  const aesKey = await deriveAesKey(prfBytes);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textEncoder.encode(secret)
  );

  return {
    encryptedSecret: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    version: "prf-hkdf-aesgcm-v1",
  };
};

export const decryptSecret = async (
  encryptedSecret: string,
  iv: string,
  prfBytes: Uint8Array
) => {
  const aesKey = await deriveAesKey(prfBytes);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    aesKey,
    base64ToBytes(encryptedSecret)
  );

  return new TextDecoder().decode(plaintext);
};

