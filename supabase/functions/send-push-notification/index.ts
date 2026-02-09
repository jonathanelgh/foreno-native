// Supabase Edge Function: send-push-notification
// Unified push notification sender.
//
// Accepts:
//   (1) Unified payload from DB trigger: { push_notification_id, expo_push_tokens[], title, body, data }
//   (2) Legacy direct payload: { expo_push_token, title, body, data }
//
// Sends to Expo Push API and updates push_notifications status.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ── Types ───────────────────────────────────────────────────────────────────

type UnifiedPayload = {
  push_notification_id: string;
  expo_push_tokens: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type LegacyPayload = {
  expo_push_token: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

function isUnifiedPayload(body: unknown): body is UnifiedPayload {
  return (
    body !== null &&
    typeof body === "object" &&
    "push_notification_id" in body &&
    "expo_push_tokens" in body &&
    Array.isArray((body as UnifiedPayload).expo_push_tokens)
  );
}

function isLegacyPayload(body: unknown): body is LegacyPayload {
  return (
    body !== null &&
    typeof body === "object" &&
    "expo_push_token" in body &&
    typeof (body as LegacyPayload).expo_push_token === "string"
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function sendToExpo(
  messages: Array<{ to: string; title: string; body: string; data: Record<string, unknown>; sound: string }>
): Promise<{ ok: boolean; result: unknown }> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
    });
    const result = await res.json();
    return { ok: res.ok, result };
  } catch (err) {
    console.error("Expo push request failed:", err);
    return { ok: false, result: { error: String(err) } };
  }
}

async function updateNotificationStatus(
  id: string,
  status: "sent" | "failed",
  errorMessage?: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return;

  const body: Record<string, unknown> = {
    status,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  };
  if (errorMessage) body.error_message = errorMessage;

  try {
    await fetch(`${supabaseUrl}/rest/v1/push_notifications?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Failed to update notification status:", err);
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
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

  let body: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === "") {
      return new Response(JSON.stringify({ error: "Empty body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    body = JSON.parse(text);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── (1) Unified payload from DB trigger ─────────────────────────────────
  if (isUnifiedPayload(body)) {
    const { push_notification_id, expo_push_tokens, title, body: pushBody, data } = body;

    // Filter valid tokens
    const validTokens = expo_push_tokens.filter(
      (t) => t && t.startsWith("ExponentPushToken[")
    );

    if (validTokens.length === 0) {
      await updateNotificationStatus(push_notification_id, "failed", "No valid expo push tokens");
      return new Response(
        JSON.stringify({ ok: true, skipped: "no_valid_tokens" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const messages = validTokens.map((token) => ({
      to: token,
      title: title || "",
      body: pushBody || "",
      data: data || {},
      sound: "default" as const,
    }));

    const { ok, result } = await sendToExpo(messages);

    if (ok) {
      await updateNotificationStatus(push_notification_id, "sent");
    } else {
      await updateNotificationStatus(
        push_notification_id,
        "failed",
        JSON.stringify(result).slice(0, 500)
      );
    }

    return new Response(JSON.stringify({ ok, result, sent_to: validTokens.length }), {
      status: ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── (2) Legacy direct payload (backwards compatibility) ─────────────────
  if (isLegacyPayload(body)) {
    const token = body.expo_push_token.trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing expo_push_token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { ok, result } = await sendToExpo([
      {
        to: token,
        title: body.title ?? "",
        body: body.body ?? "",
        data: body.data ?? {},
        sound: "default",
      },
    ]);

    return new Response(JSON.stringify(result), {
      status: ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Unknown payload ─────────────────────────────────────────────────────
  return new Response(
    JSON.stringify({
      error: "Unknown payload format. Expected push_notification_id+expo_push_tokens or expo_push_token.",
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
});
