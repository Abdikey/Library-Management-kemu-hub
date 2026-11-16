import { createFileRoute } from "@tanstack/react-router";

const cors = { "Access-Control-Allow-Origin": "*" };

// GET ?id=<paymentId> -> status of one payment
// GET ?borrowing_ids=... -> paid ids from the currently displayed loan list
export const Route = createFileRoute("/api/public/fines/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!id) {
          const ids = (new URL(request.url).searchParams.get("borrowing_ids") ?? "").split(",").filter(Boolean);
          if (!ids.length || ids.length > 100 || ids.some((value) => !/^[0-9a-f-]{36}$/i.test(value))) {
            return Response.json({ paid: [] }, { headers: cors });
          }
          const { data } = await supabaseAdmin
            .from("fine_payments").select("borrowing_id").eq("status", "paid").in("borrowing_id", ids);
          return Response.json({ paid: data ?? [] }, { headers: cors });
        }
        if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Bad id" }, { status: 400, headers: cors });
        let { data: row } = await supabaseAdmin
          .from("fine_payments").select("id,status,mpesa_receipt,result_desc,checkout_request_id,created_at").eq("id", id).maybeSingle();
        if (!row) return Response.json({ error: "Not found" }, { status: 404, headers: cors });

        // If no callback arrived after 30s, ask Safaricom directly.
        if (row.status === "pending" && row.checkout_request_id && Date.now() - new Date(row.created_at).getTime() > 30000) {
          const { queryStk } = await import("@/lib/mpesa.server");
          const q = await queryStk(row.checkout_request_id);
          if (q.ResultCode !== undefined) {
            const status = String(q.ResultCode) === "0" ? "paid" : "failed";
            await supabaseAdmin.from("fine_payments")
              .update({ status, result_desc: String(q.ResultDesc ?? "").slice(0, 200), updated_at: new Date().toISOString() })
              .eq("id", row.id).eq("status", "pending");
            row = { ...row, status, result_desc: String(q.ResultDesc ?? "") };
          }
        }
        return Response.json(
          { status: row.status, receipt: row.mpesa_receipt, message: row.result_desc },
          { headers: cors },
        );
      },
    },
  },
});
