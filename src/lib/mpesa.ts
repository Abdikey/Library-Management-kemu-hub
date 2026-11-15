// Pure M-Pesa helpers (no secrets, safe to unit test).

/** Turns 07XXXXXXXX / 01XXXXXXXX / +2547... / 2547... into 2547XXXXXXXX, or null if not a Safaricom-style mobile number. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = String(input ?? "").replace(/[\s\-()+]/g, "");
  let local: string | null = null;
  if (/^0[17]\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^254[17]\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^[17]\d{8}$/.test(digits)) local = digits;
  return local ? `254${local}` : null;
}

/** yyyyMMddHHmmss in Kenya time (UTC+3), as Daraja expects. */
export function darajaTimestamp(now: Date = new Date()): string {
  const k = new Date(now.getTime() + 3 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${k.getUTCFullYear()}${p(k.getUTCMonth() + 1)}${p(k.getUTCDate())}${p(k.getUTCHours())}${p(k.getUTCMinutes())}${p(k.getUTCSeconds())}`;
}

/** STK password = base64(shortcode + passkey + timestamp). */
export function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(shortcode + passkey + timestamp);
}

/** M-Pesa only accepts whole shillings, at least 1. */
export function payableAmount(fine: number): number {
  const n = Math.ceil(Number(fine) || 0);
  return n >= 1 ? n : 0;
}
