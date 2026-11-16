import { createFileRoute } from "@tanstack/react-router";

// Safaricom posts the STK result here. Callbacks are unsigned, so we only
// accept ones for a pending request we created, and confirm success by
// asking Safaricom directly before marking anything paid.
export const Route = createFileRoute("/api/public/fines/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ok = () => Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        const body = await request.json().catch(() => null);
        const cb = body?.Body?.stkCallback;
        const checkoutId = typeof cb?.CheckoutRequestID === "string" ? cb.CheckoutRequestID : null;
        if (!checkoutId) return ok();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { queryStk } = await import("@/lib/mpesa.server");
        const { data: row } = await supabaseAdmin
          .from("fine_payments").select("id,status,amount").eq("checkout_request_id", checkoutId).maybeSingle();
        if (!row || row.status !== "pending") return ok();

        const verified = await queryStk(checkoutId);
        // An unfinished query response is not proof of success or failure.
        if (verified.ResultCode === undefined) return ok();
        const items: { Name: string; Value?: unknown }[] = cb?.CallbackMetadata?.Item ?? [];
        const amount = Number(items.find((i) => i.Name === "Amount")?.Value);
        const success = String(verified.ResultCode) === "0" && amount === Number(row.amount);
        const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
        await supabaseAdmin.from("fine_payments").update({
          status: success ? "paid" : "failed",
          mpesa_receipt: success && typeof receipt === "string" ? receipt.slice(0, 32) : null,
          result_desc: String(verified.ResultDesc ?? cb?.ResultDesc ?? "").slice(0, 200),
          updated_at: new Date().toISOString(),
        }).eq("id", row.id).eq("status", "pending");
        return ok();
      },
    },
  },
});
