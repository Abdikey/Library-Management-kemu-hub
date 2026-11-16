import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normalizeKenyanPhone, payableAmount } from "@/lib/mpesa";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });

const Body = z.object({ borrowingId: z.string().uuid(), phone: z.string().min(9).max(16) });
const ALLOWED_ORIGINS = new Set([
  "http://localhost:8080",
  "https://id-preview--bcc1cd8c-1c16-4753-965b-8a3b6084953a.lovable.app",
  "https://project--bcc1cd8c-1c16-4753-965b-8a3b6084953a-dev.lovable.app",
  "https://project--bcc1cd8c-1c16-4753-965b-8a3b6084953a.lovable.app",
  "https://read-return-hub.lovable.app",
]);

export const Route = createFileRoute("/api/public/fines/pay")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: "Payment requests must come from the SchoolLib app." }, 403);
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid request." }, 400);
        const phone = normalizeKenyanPhone(parsed.data.phone);
        if (!phone) return json({ error: "Enter a valid Safaricom number, e.g. 0712345678." }, 400);

        const { getBorrowingFine, sendStkPush, callbackUrlFor } = await import("@/lib/mpesa.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          // The amount always comes from the database, never from the browser.
          const loan = await getBorrowingFine(parsed.data.borrowingId);
          const amount = loan ? payableAmount(loan.fine_amount) : 0;
          if (!loan || loan.status !== "returned" || amount === 0)
            return json({ error: "There is no unpaid fine on this record." }, 400);

          const { data: paid } = await supabaseAdmin
            .from("fine_payments").select("id").eq("borrowing_id", loan.id).eq("status", "paid").maybeSingle();
          if (paid) return json({ error: "This fine has already been paid." }, 409);

          const { data: recent } = await supabaseAdmin
            .from("fine_payments").select("id,status,created_at").eq("borrowing_id", loan.id)
            .gte("created_at", new Date(Date.now() - 60000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (recent) return json({ error: "Please wait one minute before trying this fine again." }, 429);

          // Claim this fine before sending a prompt. The partial unique index
          // prevents parallel attempts from charging the same assessed fine.
          const { data: row, error } = await supabaseAdmin
            .from("fine_payments")
            .insert({ borrowing_id: loan.id, amount, phone_last3: phone.slice(-3) })
            .select("id").single();
          if (error) {
            if (error.code === "23505") return json({ error: "A payment for this fine is already pending or completed." }, 409);
            throw error;
          }
          try {
            const checkoutId = await sendStkPush({
              phone, amount, reference: "LIBFINE", callbackUrl: callbackUrlFor(request),
            });
            const { error: updateError } = await supabaseAdmin
              .from("fine_payments").update({ checkout_request_id: checkoutId })
              .eq("id", row.id).eq("status", "pending");
            if (updateError) throw updateError;
          } catch (pushError) {
            await supabaseAdmin.from("fine_payments").update({
              status: "failed", result_desc: "Could not send the M-Pesa prompt.", updated_at: new Date().toISOString(),
            }).eq("id", row.id).eq("status", "pending");
            throw pushError;
          }
          return json({ paymentId: row.id, amount });
        } catch (e) {
          console.error("pay failed", e);
          const message = e instanceof Error && e.message.startsWith("M-Pesa is not set up")
            ? e.message
            : "Safaricom could not start the test prompt. Check the sandbox setup and try again.";
          return json({ error: message }, 502);
        }
      },
    },
  },
});
