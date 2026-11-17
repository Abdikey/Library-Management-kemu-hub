// Server-only: talks to the Safaricom Daraja SANDBOX and the library database.
import { darajaTimestamp, stkPassword } from "./mpesa";

export const DARAJA_BASE = "https://sandbox.safaricom.co.ke";
export const SANDBOX_SHORTCODE = "174379";

// The library's own database (public read key, same one the pages use).
const LIBRARY_URL = "https://tkysqvuzwhjaunxwhhau.supabase.co";
const LIBRARY_KEY = "sb_publishable_6PFpSs1hZ9nC7Mt526nBRA_n2wOQvsj";

function creds() {
  const key = process.env["DARAJA_CONSUMER_KEY"];
  const secret = process.env["DARAJA_CONSUMER_SECRET"];
  const passkey = process.env["DARAJA_PASSKEY"];
  if (!key || !secret || !passkey) throw new Error("M-Pesa is not set up yet (missing Daraja sandbox keys).");
  return { key, secret, passkey };
}

async function accessToken(): Promise<string> {
  const { key, secret } = creds();
  const res = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Daraja auth failed [${res.status}]: ${text}`);
  return JSON.parse(text).access_token;
}

export async function sendStkPush(opts: { phone: string; amount: number; reference: string; callbackUrl: string }) {
  const { passkey } = creds();
  const token = await accessToken();
  const ts = darajaTimestamp();
  const res = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: SANDBOX_SHORTCODE,
      Password: stkPassword(SANDBOX_SHORTCODE, passkey, ts),
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: opts.amount,
      PartyA: opts.phone,
      PartyB: SANDBOX_SHORTCODE,
      PhoneNumber: opts.phone,
      CallBackURL: opts.callbackUrl,
      AccountReference: opts.reference.slice(0, 12),
      TransactionDesc: "Library fine",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ResponseCode !== "0") {
    console.error("STK push failed", res.status, body);
    throw new Error(body.errorMessage || body.ResponseDescription || "M-Pesa could not send the prompt.");
  }
  return body.CheckoutRequestID as string;
}

/** Asks Safaricom directly what happened (used to verify callbacks). */
export async function queryStk(checkoutRequestId: string) {
  const { passkey } = creds();
  const token = await accessToken();
  const ts = darajaTimestamp();
  const res = await fetch(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: SANDBOX_SHORTCODE,
      Password: stkPassword(SANDBOX_SHORTCODE, passkey, ts),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  return (await res.json().catch(() => ({}))) as { ResultCode?: string; ResultDesc?: string; errorCode?: string };
}

/** Reads the fine for one returned borrowing from the library database. */
export async function getBorrowingFine(borrowingId: string) {
  const res = await fetch(
    `${LIBRARY_URL}/rest/v1/borrowings?id=eq.${encodeURIComponent(borrowingId)}&select=id,status,fine_amount`,
    { headers: { apikey: LIBRARY_KEY } },
  );
  if (!res.ok) throw new Error("Could not read the fine from the library database.");
  const rows = (await res.json()) as { id: string; status: string; fine_amount: number }[];
  return rows[0] ?? null;
}

export function callbackUrlFor(request: Request) {
  const origin = new URL(request.url).origin;
  const base = origin === "https://read-return-hub.lovable.app"
    || origin === "https://project--bcc1cd8c-1c16-4753-965b-8a3b6084953a.lovable.app"
    ? origin
    : "https://project--bcc1cd8c-1c16-4753-965b-8a3b6084953a-dev.lovable.app";
  return `${base}/api/public/fines/callback`;
}
