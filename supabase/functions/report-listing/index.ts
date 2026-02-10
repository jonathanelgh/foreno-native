// Supabase Edge Function: report-listing
// Sends a report email to support@foreno.se when a user reports a listing.
//
// Required secrets:
//   RESEND_API_KEY – API key from https://resend.com
//
// Payload:
//   {
//     listing_id, listing_title, listing_description, listing_price,
//     listing_transaction_type, listing_category, listing_city,
//     listing_created_by_name,
//     reporter_id, reporter_name, reporter_email,
//     subject, message
//   }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPPORT_EMAIL = "support@foreno.se";

type ReportPayload = {
  listing_id: string;
  listing_title: string;
  listing_description?: string;
  listing_price?: string;
  listing_transaction_type?: string;
  listing_category?: string;
  listing_city?: string;
  listing_created_by_name?: string;
  reporter_id: string;
  reporter_name: string;
  reporter_email?: string;
  subject: string;
  message: string;
};

function buildHtmlEmail(data: ReportPayload): string {
  const transactionLabel =
    data.listing_transaction_type === "sell"
      ? "Säljes"
      : data.listing_transaction_type === "buy"
      ? "Köpes"
      : data.listing_transaction_type === "give"
      ? "Skänkes"
      : data.listing_transaction_type || "–";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 4px 0; color: #991b1b; font-size: 18px;">Rapporterad annons</h2>
        <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 500;">${data.subject}</p>
      </div>

      <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Rapportörens meddelande</h3>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #374151; white-space: pre-wrap;">${data.message || "Inget meddelande bifogat."}</p>
      </div>

      <h3 style="color: #111827; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Annonsdetaljer</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Annons-ID</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; border-bottom: 1px solid #f3f4f6; font-family: monospace;">${data.listing_id}</td></tr>
        <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Titel</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; border-bottom: 1px solid #f3f4f6; font-weight: 600;">${data.listing_title}</td></tr>
        <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Typ</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; border-bottom: 1px solid #f3f4f6;">${transactionLabel}</td></tr>
        <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Pris</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; border-bottom: 1px solid #f3f4f6;">${data.listing_price || "–"}</td></tr>
        <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Kategori</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; border-bottom: 1px solid #f3f4f6;">${data.listing_category || "–"}</td></tr>
        <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Plats</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; border-bottom: 1px solid #f3f4f6;">${data.listing_city || "–"}</td></tr>
        <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Skapad av</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; border-bottom: 1px solid #f3f4f6;">${data.listing_created_by_name || "–"}</td></tr>
        ${data.listing_description ? `<tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; vertical-align: top;">Beskrivning</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; white-space: pre-wrap;">${data.listing_description.slice(0, 500)}</td></tr>` : ""}
      </table>

      <h3 style="color: #111827; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Rapporterad av</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Namn</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; border-bottom: 1px solid #f3f4f6;">${data.reporter_name}</td></tr>
        <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Användar-ID</td><td style="padding: 8px 12px; color: #111827; font-size: 13px; border-bottom: 1px solid #f3f4f6; font-family: monospace;">${data.reporter_id}</td></tr>
        ${data.reporter_email ? `<tr><td style="padding: 8px 12px; color: #6b7280; font-size: 13px;">E-post</td><td style="padding: 8px 12px; color: #111827; font-size: 13px;">${data.reporter_email}</td></tr>` : ""}
      </table>

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">Detta mail skickades automatiskt från Föreno-appen.</p>
      </div>
    </div>
  `;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let data: ReportPayload;
  try {
    data = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate required fields
  if (!data.listing_id || !data.listing_title || !data.reporter_id || !data.reporter_name || !data.subject) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: listing_id, listing_title, reporter_id, reporter_name, subject" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const emailSubject = `Rapporterad annons: ${data.subject} – "${data.listing_title}"`;
  const htmlBody = buildHtmlEmail(data);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Föreno <noreply@foreno.se>",
        to: [SUPPORT_EMAIL],
        subject: emailSubject,
        html: htmlBody,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", result);
      return new Response(JSON.stringify({ error: "Failed to send email", details: result }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, email_id: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error sending report email:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
